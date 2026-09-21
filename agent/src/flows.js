import { gradeHarvest } from "./grading/gradeHarvest.js";
import { verifyDelivery } from "./delivery/verifyDelivery.js";
import { postGradeOnChain, postDeliveryOnChain, readListing } from "./blockchain/escrow.js";
import { uploadImage, fetchAsDataUrl } from "./ipfs/pinata.js";
import { logEvent, logManualReview } from "./logs/logger.js";
import { config } from "./config.js";

/**
 * End-to-end Stage 1: grade a harvest photo and (if confident) post it on-chain.
 * @param {{listingId: number|string, cropType: string, weightKg: number|string,
 *          photoBytes?: Buffer, photoDataUrl?: string, photoFilename?: string,
 *          postOnChain?: boolean}} input
 */
export async function runGrading(input) {
  const task = "gradeHarvest";
  const listingId = input.listingId;

  const photoDataUrl =
    input.photoDataUrl ?? (await toDataUrl(input.photoBytes, input.photoFilename, input.photoContentType));

  const grading = await gradeHarvest({
    photoDataUrl,
    cropType: input.cropType,
    weightKg: input.weightKg,
    photoFilename: input.photoFilename,
  });

  logEvent({
    level: "info",
    task,
    message: "grading complete",
    listingId,
    grade: grading.grade,
    confidence: grading.confidence,
    reasons: grading.reasons,
    model: grading.model,
  });

  if (grading.confidence < config.minConfidence) {
    logManualReview({
      task,
      listingId,
      reason: "confidence_below_threshold",
      threshold: config.minConfidence,
      grade: grading.grade,
      confidence: grading.confidence,
      reasons: grading.reasons,
    });
    return { status: "MANUAL_REVIEW", ...grading, posted: false };
  }

  let reasonURI = "";
  if (input.reasonBytes) {
    const up = await uploadImage({
      bytes: input.reasonBytes,
      filename: `${listingId}-grade-reason.json`,
      contentType: "application/json",
    });
    reasonURI = up.photoURI;
  } else {
    const up = await uploadImage({
      bytes: Buffer.from(JSON.stringify(grading), "utf8"),
      filename: `${listingId}-grade-reason.json`,
      contentType: "application/json",
    });
    reasonURI = up.photoURI;
  }

  if (input.postOnChain === false) {
    return { status: "GRADED", ...grading, reasonURI, posted: false };
  }

  const receipt = await postGradeOnChain({
    listingId,
    grade: grading.grade,
    reasonURI,
    confidence: grading.confidence,
  });

  return { status: "GRADED", ...grading, reasonURI, posted: true, ...receipt };
}

/**
 * End-to-end Stage 2: compare original vs received goods and post the result.
 * Falls back to reading the locked grade from the contract when not supplied.
 */
export async function runDeliveryVerification(input) {
  const task = "verifyDelivery";
  const listingId = input.listingId;

  let grade = input.grade;
  let cropType = input.cropType;
  let weightKg = input.weightKg;
  let originalPhotoDataUrl = input.originalPhotoDataUrl;

  // Read whatever is missing from the chain. The locked grade and the original
  // photo always come from the contract, never from the caller.
  if (!grade || !cropType || !weightKg || !originalPhotoDataUrl) {
    const listing = await readListing(listingId);
    grade = grade ?? listing.grade;
    cropType = cropType ?? listing.cropType;
    weightKg = weightKg ?? listing.weightKg;
    originalPhotoDataUrl = originalPhotoDataUrl ?? (await fetchAsDataUrl(listing.photoURI));
  }

  const deliveryPhotoDataUrl =
    input.deliveryPhotoDataUrl ??
    (await toDataUrl(input.deliveryPhotoBytes, input.deliveryFilename, input.deliveryContentType));

  const verification = await verifyDelivery({
    originalPhotoDataUrl,
    deliveryPhotoDataUrl,
    grade,
    cropType,
    weightKg,
    deliveryFilename: input.deliveryFilename,
  });

  logEvent({
    level: "info",
    task,
    message: "verification complete",
    listingId,
    matched: verification.matched,
    confidence: verification.confidence,
    differences: verification.differences,
    model: verification.model,
  });

  if (verification.confidence < config.minConfidence) {
    logManualReview({
      task,
      listingId,
      reason: "confidence_below_threshold",
      threshold: config.minConfidence,
      matched: verification.matched,
      confidence: verification.confidence,
      differences: verification.differences,
    });
    return { status: "MANUAL_REVIEW", ...verification, posted: false };
  }

  const up = await uploadImage({
    bytes: Buffer.from(JSON.stringify(verification), "utf8"),
    filename: `${listingId}-delivery-reason.json`,
    contentType: "application/json",
  });

  if (input.postOnChain === false) {
    return { status: verification.matched ? "MATCHED" : "MISMATCH", ...verification, reasonURI: up.photoURI, posted: false };
  }

  const receipt = await postDeliveryOnChain({
    listingId,
    matched: verification.matched,
    confidence: verification.confidence,
    reasonURI: up.photoURI,
  });

  return {
    status: verification.matched ? "MATCHED" : "MISMATCH",
    ...verification,
    reasonURI: up.photoURI,
    posted: true,
    ...receipt,
  };
}

async function toDataUrl(bytes, filename, contentType) {
  if (!bytes) throw new Error("No image bytes or data URL provided");
  // Sniff the real MIME; the AI gateway rejects a mismatch between the declared
  // data-URL MIME and the actual image bytes.
  const up = await uploadImage({ bytes, filename: filename ?? "photo.jpg", contentType });
  return up.photoURI;
}
