import { test } from "node:test";
import assert from "node:assert/strict";

import {
  isNonceError,
  describeTxError,
  assertExpectedChain,
  assertAccountReady,
  runPreflight,
  NONCE_HINT,
} from "./txGuard.js";

const VALID = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

test("runPreflight passes on correct chain and account", () => {
  const out = runPreflight({
    currentChainId: 31337,
    expectedChainId: 31337,
    currentAddress: VALID,
  });
  assert.equal(out.address, VALID);
});

test("runPreflight blocks on wrong chain", () => {
  assert.throws(
    () =>
      runPreflight({
        currentChainId: 97,
        expectedChainId: 31337,
        currentAddress: VALID,
      }),
    /Network salah/,
  );
});

test("runPreflight blocks when there is no account", () => {
  assert.throws(
    () => runPreflight({ currentChainId: 31337, expectedChainId: 31337, currentAddress: undefined }),
    /Tidak ada akun aktif/,
  );
});

test("assertExpectedChain rejects missing chain id", () => {
  assert.throws(() => assertExpectedChain(undefined, 31337), /belum terhubung/);
});

test("assertAccountReady rejects malformed address", () => {
  assert.throws(() => assertAccountReady("0x123"), /Tidak ada akun aktif/);
  assert.throws(() => assertAccountReady(null), /Tidak ada akun aktif/);
});

test("isNonceError detects the common stale-nonce phrases", () => {
  for (const msg of [
    "nonce too low",
    "Nonce too high",
    "replacement transaction underpriced",
    "already known",
    "known transaction",
  ]) {
    assert.equal(isNonceError({ shortMessage: msg }), true, msg);
  }
  assert.equal(isNonceError({ shortMessage: "insufficient funds" }), false);
});

test("isNonceError reads nested cause messages", () => {
  assert.equal(isNonceError({ cause: { message: "nonce too low" } }), true);
});

test("describeTxError maps nonce errors to the actionable hint", () => {
  const out = describeTxError({ shortMessage: "nonce too low" });
  assert.equal(out.kind, "nonce");
  assert.equal(out.message, NONCE_HINT);
});

test("describeTxError maps user rejection", () => {
  assert.equal(describeTxError({ code: 4001 }).kind, "rejected");
  assert.equal(describeTxError({ shortMessage: "User rejected the request" }).kind, "rejected");
});

test("describeTxError maps insufficient funds", () => {
  assert.equal(describeTxError({ shortMessage: "insufficient funds for gas" }).kind, "funds");
});

test("describeTxError keeps the underlying detail for unknown errors", () => {
  const out = describeTxError({ shortMessage: "Invalid parameters were provided to the RPC method" });
  assert.equal(out.kind, "unknown");
  assert.match(out.message, /Invalid parameters/);
});
