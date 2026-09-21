import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { config } from "../config.js";
import { logEvent } from "../logs/logger.js";

/**
 * Uploads an image to IPFS via Pinata and returns its CID + gateway URL.
 * Falls back to a data URL + local sha256 hash when Pinata is not configured,
 * which keeps the on-chain hash as the integrity reference (spec §6).
 */
export async function uploadImage({ bytes, filename, contentType }) {
  const hashHex = sha256Hex(bytes);
  const mime = contentType ?? sniffImageMime(bytes);

  if (!config.ipfs.pinataJwt) {
    logEvent({
      level: "warn",
      task: "ipfs",
      message: "Pinata not configured; using inline data URL fallback",
      hash: hashHex,
      mime,
    });
    const dataUrl = `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
    return { photoURI: dataUrl, hashHex, provider: "data-url" };
  }

  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mime }), filename ?? "upload.jpg");

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.ipfs.pinataJwt}` },
    body: form,
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Pinata upload failed (${res.status}): ${text.slice(0, 300)}`);

  const json = JSON.parse(text);
  const cid = json.IpfsHash;
  const photoURI = `${config.ipfs.gateway.replace(/\/$/, "")}/${cid}`;

  logEvent({ level: "info", task: "ipfs", message: "pinned to IPFS", cid, hash: hashHex });
  return { photoURI, hashHex, cid, provider: "pinata" };
}

export function sha256Hex(bytes) {
  return "0x" + createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

/**
 * Sniffs the image MIME type from magic bytes. The AI gateway rejects requests
 * whose declared data-URL MIME does not match the actual bytes, so we must not
 * guess "image/jpeg" for everything.
 */
export function sniffImageMime(bytes) {
  const b = Buffer.from(bytes);
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return "image/png";
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return "image/jpeg";
  }
  if (b.length >= 6 && b.subarray(0, 3).toString("ascii") === "GIF") {
    return "image/gif";
  }
  if (
    b.length >= 12 &&
    b.subarray(0, 4).toString("ascii") === "RIFF" &&
    b.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return "image/jpeg";
}

/**
 * Fetches an IPFS/HTTP image and returns it as a base64 data URL so it can be
 * passed to the vision model.
 */
export async function fetchAsDataUrl(uri) {
  if (!uri) throw new Error("fetchAsDataUrl: empty URI");
  if (uri.startsWith("data:")) return uri;

  // Local file URI (used during local/Anvil development).
  if (uri.startsWith("file://")) {
    const path = uri.slice("file://".length).replace(/^\/([A-Za-z]:)/, "$1");
    const bytes = readFileSync(path);
    return `data:${sniffImageMime(bytes)};base64,${bytes.toString("base64")}`;
  }

  const url = uri.startsWith("ipfs://")
    ? `${config.ipfs.gateway.replace(/\/$/, "")}/${uri.slice("ipfs://".length)}`
    : uri;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image ${url} (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:${sniffImageMime(buf)};base64,${buf.toString("base64")}`;
}
