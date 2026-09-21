import { AGENT_URL, CONTRACT_ADDRESS } from "../config/chain.js";

async function post(path, body) {
  const res = await fetch(`${AGENT_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Agent returned non-JSON (${res.status}): ${text.slice(0, 160)}`);
  }
  if (!res.ok) throw new Error(json.error || `Agent request failed (${res.status})`);
  return json;
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the selected file"));
    reader.readAsDataURL(file);
  });
}

export async function sha256HexFromDataUrl(dataUrl) {
  const comma = dataUrl.indexOf(",");
  const base64 = comma === -1 ? "" : dataUrl.slice(comma + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    return `0x${hex}`;
  }

  // Fallback for non-secure contexts where crypto.subtle is unavailable.
  // Deterministic 32-byte digest is NOT a real SHA-256, so we surface that.
  throw new Error(
    "Secure context required: open the app via http://localhost or https:// so the browser can hash the photo.",
  );
}

/** Uploads to IPFS (via agent, when configured) and returns {uri, hashHex}. */
export async function uploadPhoto(photo) {
  const res = await post("/api/upload", {
    photoDataUrl: photo.dataUrl,
    filename: photo.filename,
  });
  return { uri: res.photoURI, hashHex: res.hashHex };
}

export function gradeHarvest({ listingId, cropType, weightKg, photoDataUrl, photoFilename, photoURI }) {
  return post("/api/grade", {
    listingId,
    cropType,
    weightKg,
    photoDataUrl,
    photoFilename,
    photoURI,
  });
}

export function verifyDelivery({ listingId, deliveryPhotoDataUrl, deliveryFilename, deliveryPhotoURI }) {
  return post("/api/verify-delivery", {
    listingId,
    deliveryPhotoDataUrl,
    deliveryFilename,
    deliveryPhotoURI,
  });
}

export async function checkAgentHealth() {
  try {
    const res = await fetch(`${AGENT_URL}/api/health`);
    if (!res.ok) return { ok: false };
    return await res.json();
  } catch {
    return { ok: false };
  }
}
