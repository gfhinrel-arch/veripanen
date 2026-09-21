import { config } from "../config.js";
import { logEvent } from "../logs/logger.js";

/**
 * Minimal OpenAI-compatible chat client for the 9router gateway.
 * No SDK on purpose: the gateway speaks the standard /chat/completions shape.
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callChat({ model, messages, temperature }) {
  const url = `${config.ai.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.ai.timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.ai.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages, temperature }),
      signal: controller.signal,
    });

    const text = await res.text();
    if (!res.ok) {
      const err = new Error(`AI HTTP ${res.status}: ${text.slice(0, 400)}`);
      err.retryable =
        res.status === 429 ||
        res.status === 502 ||
        res.status === 503 ||
        res.status === 504 ||
        /model_unavailable|sedang riset|rate.?limit/i.test(text);
      throw err;
    }

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      const err = new Error(`AI returned non-JSON envelope: ${text.slice(0, 300)}`);
      err.retryable = true;
      throw err;
    }

    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.length === 0) {
      throw new Error(`AI returned empty content: ${JSON.stringify(json).slice(0, 300)}`);
    }
    return { content, usage: json.usage ?? null };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Extract the first JSON object from a model response.
 * Handles ```json fences and leading prose defensively.
 */
export function extractJson(content) {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : content).trim();

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error(`No JSON object found in model output: ${content.slice(0, 300)}`);
  }
}

/**
 * Calls the model, parses JSON, validates it, and retries on invalid output.
 * Rotates across the configured model list. Per model, retryable transport
 * errors (502/503 from the flaky gateway) are retried quickly once; anything
 * else fails that model immediately and moves on.
 */
export async function callJsonWithRetry({ system, userContent, validate, task }) {
  const models = config.ai.models;
  const maxRounds = config.ai.maxRetries;
  let lastError = null;
  let attempts = 0;

  for (let round = 0; round < maxRounds; round += 1) {
    for (const model of models) {
      attempts += 1;
      try {
        const { content, usage } = await callChat({
          model,
          temperature: config.ai.temperature,
          messages: [
            { role: "system", content: system },
            { role: "user", content: userContent },
          ],
        });

        const parsed = extractJson(content);
        validate(parsed);

        logEvent({
          level: "info",
          task,
          message: "AI result accepted",
          model,
          attempt: attempts,
          usage,
          result: parsed,
        });

        return { value: parsed, model, attempts };
      } catch (error) {
        lastError = error;
        logEvent({
          level: "warn",
          task,
          message: "AI attempt failed",
          model,
          attempt: attempts,
          retryable: error.retryable === true,
          error: error.message,
        });
        // Short pause per attempt; long backoff only between full rounds.
        await sleep(config.ai.backoffMs / 3);
      }
    }
    if (round < maxRounds - 1) await sleep(config.ai.backoffMs * 2 ** round);
  }

  logEvent({
    level: "error",
    task,
    message: "AI failed after all retries",
    error: lastError?.message ?? "unknown",
    attempts,
  });
  throw new Error(`AI ${task} failed after ${attempts} attempts: ${lastError?.message}`);
}
