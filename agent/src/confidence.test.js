import { test } from "node:test";
import assert from "node:assert/strict";

// The flow modules read config at import time. Pin the threshold to the blueprint
// default BEFORE importing them, so the test is independent of the developer's
// local .env (which may carry a demo override).
process.env.MIN_CONFIDENCE = "70";

const { resolveMinConfidence } = await import("./config.js");
const { runGrading } = await import("./flows.js");

const DEFAULT = 70;

test("resolveMinConfidence defaults to 70 when unset", () => {
  assert.equal(resolveMinConfidence(undefined), DEFAULT);
  assert.equal(resolveMinConfidence(""), DEFAULT);
});

test("resolveMinConfidence accepts an explicit valid override", () => {
  assert.equal(resolveMinConfidence("85"), 85);
  assert.equal(resolveMinConfidence("70"), 70);
  assert.equal(resolveMinConfidence("0"), 0);
  assert.equal(resolveMinConfidence("100"), 100);
});

test("resolveMinConfidence rejects invalid values and falls back to 70", () => {
  for (const bad of ["abc", "-1", "101", "NaN", "Infinity"]) {
    assert.equal(resolveMinConfidence(bad), DEFAULT, `expected fallback for "${bad}"`);
  }
});

/**
 * Stage 1 must not touch the chain when confidence is below the threshold.
 * We stub global fetch: the single expected network call is the AI gateway,
 * which returns confidence 69. Any RPC write would show up as an extra fetch,
 * so asserting exactly one call proves zero blockchain writes.
 */
test("runGrading with confidence 69 returns MANUAL_REVIEW and sends no blockchain write", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: init?.body });
    return {
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          choices: [{ message: { content: '{"grade":"C","confidence":69,"reasons":["blurry"]}' } }],
          usage: null,
        }),
    };
  };

  try {
    const result = await runGrading({
      listingId: 1,
      cropType: "Rice",
      weightKg: 100,
      photoDataUrl: "data:image/png;base64,iVBORw0KGgo=",
      photoFilename: "rice.png",
      postOnChain: true,
    });

    assert.equal(result.status, "MANUAL_REVIEW");
    assert.equal(result.posted, false);
    assert.equal(result.confidence, 69);
    assert.equal(calls.length, 1, "only the AI call is allowed; no RPC write");
    assert.match(calls[0].url, /chat\/completions$/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

/**
 * confidence exactly at the threshold must pass the gate. We do not let it reach
 * a real chain write: postOnChain=false keeps it off-chain while still proving
 * the threshold comparison uses `<` (i.e. 70 is not rejected).
 */
test("runGrading with confidence 70 is not rejected by the threshold", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({
        choices: [{ message: { content: '{"grade":"B","confidence":70,"reasons":["ok"]}' } }],
        usage: null,
      }),
  });

  try {
    const result = await runGrading({
      listingId: 1,
      cropType: "Rice",
      weightKg: 100,
      photoDataUrl: "data:image/png;base64,iVBORw0KGgo=",
      photoFilename: "rice.png",
      postOnChain: false,
    });

    assert.equal(result.status, "GRADED");
    assert.equal(result.posted, false);
    assert.equal(result.confidence, 70);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
