/**
 * Sanitization for untrusted user text (crop type, notes, filenames).
 * Goal: never let user text masquerade as privileged instructions.
 * We do not execute anything; we only neutralize control characters and
 * clamp length, then render the text clearly inside a delimited data block.
 */
export function sanitizeText(input, { maxLength = 200 } = {}) {
  if (input === undefined || input === null) return "";
  let s = String(input);
  // Strip control characters and zero-width / bidi tricks.
  s = s.replace(/[\u0000-\u001F\u007F-\u009F]/g, " ");
  s = s.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, "");
  // Collapse whitespace.
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > maxLength) s = s.slice(0, maxLength);
  return s;
}

export function sanitizeList(items, { maxItems = 8, maxLength = 120 } = {}) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, maxItems).map((i) => sanitizeText(i, { maxLength }));
}

/**
 * Compares a sanitized filename against an allowed charset. Returns null when
 * the filename looks suspicious, so callers can decide to ignore it.
 */
export function safeFilename(name) {
  const s = sanitizeText(name, { maxLength: 128 });
  if (!s) return null;
  if (!/^[\w.\- ]+$/.test(s)) return null;
  return s;
}
