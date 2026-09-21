import { test } from "node:test";
import assert from "node:assert/strict";

import { extractJson } from "./ai/glm.js";
import { validateGrading } from "./grading/gradeHarvest.js";
import { validateDelivery } from "./delivery/verifyDelivery.js";
import { sanitizeText, sanitizeList, safeFilename } from "./validation/sanitize.js";
import { sniffImageMime, sha256Hex } from "./ipfs/pinata.js";

test("extractJson parses raw json", () => {
  assert.deepEqual(extractJson('{"grade":"A"}'), { grade: "A" });
});

test("extractJson parses fenced json", () => {
  assert.deepEqual(extractJson('Sure!\n```json\n{"grade":"B"}\n```'), { grade: "B" });
});

test("extractJson parses json surrounded by prose", () => {
  assert.deepEqual(extractJson('Here you go: {"grade":"C"} done'), { grade: "C" });
});

test("extractJson throws on no json", () => {
  assert.throws(() => extractJson("no json here"));
});

test("validateGrading accepts valid object", () => {
  const out = validateGrading({ grade: "a", confidence: 92, reasons: ["ok"] });
  assert.equal(out.grade, "A");
  assert.equal(out.confidence, 92);
});

test("validateGrading rejects bad grade", () => {
  assert.throws(() => validateGrading({ grade: "D", confidence: 90, reasons: [] }));
});

test("validateGrading rejects non-integer confidence", () => {
  assert.throws(() => validateGrading({ grade: "A", confidence: "90", reasons: [] }));
});

test("validateGrading rejects confidence above 100", () => {
  assert.throws(() => validateGrading({ grade: "A", confidence: 101, reasons: [] }));
});

test("validateGrading rejects non-array reasons", () => {
  assert.throws(() => validateGrading({ grade: "A", confidence: 90, reasons: "nope" }));
});

test("validateDelivery accepts valid object", () => {
  const out = validateDelivery({ matched: true, confidence: 91, differences: [] });
  assert.equal(out.matched, true);
});

test("validateDelivery rejects non-boolean matched", () => {
  assert.throws(() => validateDelivery({ matched: "true", confidence: 91, differences: [] }));
});

test("validateDelivery rejects matched=true with differences", () => {
  assert.throws(() =>
    validateDelivery({ matched: true, confidence: 91, differences: ["color changed"] }),
  );
});

test("validateDelivery accepts mismatch with differences", () => {
  const out = validateDelivery({ matched: false, confidence: 88, differences: ["color changed"] });
  assert.equal(out.matched, false);
  assert.deepEqual(out.differences, ["color changed"]);
});

test("sanitizeText strips control chars and bidi", () => {
  assert.equal(sanitizeText("a\u0000b\u202Ec"), "a bc");
  assert.equal(sanitizeText("  hi   there  "), "hi there");
});

test("sanitizeText clamps length", () => {
  assert.equal(sanitizeText("x".repeat(500), { maxLength: 10 }).length, 10);
});

test("sanitizeList filters non-arrays", () => {
  assert.deepEqual(sanitizeList("nope"), []);
  assert.deepEqual(sanitizeList(["a", "b"]), ["a", "b"]);
});

test("safeFilename rejects path traversal", () => {
  assert.equal(safeFilename("../../etc/passwd"), null);
  assert.equal(safeFilename("photo.jpg"), "photo.jpg");
});

test("sniffImageMime detects png", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(sniffImageMime(png), "image/png");
});

test("sniffImageMime detects jpeg", () => {
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  assert.equal(sniffImageMime(jpg), "image/jpeg");
});

test("sniffImageMime defaults to jpeg", () => {
  assert.equal(sniffImageMime(Buffer.from([1, 2, 3, 4])), "image/jpeg");
});

test("sha256Hex is stable and prefixed", () => {
  const h = sha256Hex(Buffer.from("veripanen"));
  assert.match(h, /^0x[0-9a-f]{64}$/);
  assert.equal(h, sha256Hex(Buffer.from("veripanen")));
});
