/**
 * Pure URI helpers. Kept free of Vite-only globals (import.meta.env) so they can
 * be unit-tested under plain Node.
 */

// A CIDv0 is "Qm" + 44 base58 chars; a CIDv1 starts with "b" and is base32.
const CID_RE = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{58,})$/;

/**
 * True when a reasoning/photo URI points at something that can actually be
 * fetched. Seed and demo records written before real uploads existed use
 * placeholders such as "ipfs://grade-1", which no gateway can resolve.
 */
export function isResolvableRecordUri(uri) {
  if (!uri) return false;
  if (uri.startsWith("data:") || uri.startsWith("file://") || uri.startsWith("http")) return true;
  if (uri.startsWith("ipfs://")) return CID_RE.test(uri.slice("ipfs://".length));
  return false;
}
