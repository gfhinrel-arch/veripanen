import { test } from "node:test";
import assert from "node:assert/strict";

import { isResolvableRecordUri } from "./uri.js";

test("rejects legacy placeholder ipfs records", () => {
  assert.equal(isResolvableRecordUri("ipfs://grade-1"), false);
  assert.equal(isResolvableRecordUri("ipfs://delivery-1"), false);
  assert.equal(isResolvableRecordUri("ipfs://legit"), false);
  assert.equal(isResolvableRecordUri("ipfs://reason"), false);
});

test("accepts a real CIDv0", () => {
  assert.equal(
    isResolvableRecordUri("ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"),
    true,
  );
});

test("accepts a real CIDv1", () => {
  assert.equal(
    isResolvableRecordUri("ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"),
    true,
  );
});

test("accepts data, file and http URIs", () => {
  assert.equal(isResolvableRecordUri("data:application/json;base64,abc"), true);
  assert.equal(isResolvableRecordUri("file:///C:/tmp/x.json"), true);
  assert.equal(isResolvableRecordUri("https://example.com/x.json"), true);
});

test("rejects empty and unknown schemes", () => {
  assert.equal(isResolvableRecordUri(""), false);
  assert.equal(isResolvableRecordUri(null), false);
  assert.equal(isResolvableRecordUri("ftp://x"), false);
});
