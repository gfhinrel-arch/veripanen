#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runGrading, runDeliveryVerification } from "./flows.js";
import { getOracleAddress, readListing } from "./blockchain/escrow.js";
import { sniffImageMime } from "./ipfs/pinata.js";

const [command, ...rest] = process.argv.slice(2);
const flags = parseFlags(rest);

function parseFlags(args) {
  const out = {};
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        out[key] = next;
        i += 1;
      } else {
        out[key] = true;
      }
    }
  }
  return out;
}

function readImage(path) {
  if (!path) throw new Error("--photo <path> is required");
  return readFileSync(resolve(process.cwd(), path));
}

function print(value) {
  console.log(
    JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2),
  );
}

async function main() {
  switch (command) {
    case "oracle": {
      console.log("Oracle address:", getOracleAddress());
      break;
    }

    case "listing": {
      const listing = await readListing(flags.id);
      print(serializeListing(listing));
      break;
    }

    case "grade": {
      const result = await runGrading({
        listingId: flags.id,
        cropType: flags.crop,
        weightKg: flags.weight,
        photoBytes: readImage(flags.photo),
        photoFilename: flags.photo,
        postOnChain: flags["no-post"] !== true,
      });
      print(result);
      break;
    }

    case "verify": {
      let originalPhotoDataUrl;
      if (flags.original) {
        const bytes = readImage(flags.original);
        originalPhotoDataUrl = `data:${sniffImageMime(bytes)};base64,${bytes.toString("base64")}`;
      }
      const result = await runDeliveryVerification({
        listingId: flags.id,
        deliveryPhotoBytes: readImage(flags.delivery),
        deliveryFilename: flags.delivery,
        originalPhotoDataUrl,
        grade: flags.grade,
        postOnChain: flags["no-post"] !== true,
      });
      print(result);
      break;
    }

    default:
      console.log(`VeriPanen agent CLI

Usage:
  node src/cli.js oracle                          show oracle address
  node src/cli.js listing --id <n>                read a listing from chain
  node src/cli.js grade   --id <n> --crop <type> --weight <kg> --photo <path> [--no-post]
  node src/cli.js verify  --id <n> --delivery <path> [--grade A] [--no-post]
`);
  }
}

function serializeListing(l) {
  return {
    listingId: l.listingId.toString(),
    farmer: l.farmer,
    buyer: l.buyer,
    cropType: l.cropType,
    weightKg: l.weightKg.toString(),
    priceWei: l.priceWei.toString(),
    photoHash: l.photoHash,
    photoURI: l.photoURI,
    grade: l.grade,
    gradeReasonURI: l.gradeReasonURI,
    gradeConfidence: l.gradeConfidence.toString(),
    deliveryVerified: l.deliveryVerified,
    deliveryMatched: l.deliveryMatched,
    deliveryReasonURI: l.deliveryReasonURI,
    deliveryConfidence: l.deliveryConfidence.toString(),
    status: Number(l.status),
    deliveryDeadline: l.deliveryDeadline.toString(),
  };
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  process.exit(1);
});
