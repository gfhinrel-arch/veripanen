import { appendFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "../config.js";

function ensureLogsDir() {
  if (!existsSync(config.logsDir)) mkdirSync(config.logsDir, { recursive: true });
}

/**
 * Append-only JSONL audit log. Every AI decision and on-chain post is recorded
 * here with timestamp, confidence, reasons, and transaction hash.
 */
export function logEvent(event) {
  ensureLogsDir();
  const record = {
    ts: new Date().toISOString(),
    ...event,
  };
  const line = JSON.stringify(record);
  appendFileSync(resolve(config.logsDir, "agent.jsonl"), line + "\n", "utf8");

  const marker = record.level === "error" ? "ERR" : record.level === "warn" ? "WRN" : "INF";
  console.log(`[${marker}] ${record.task ?? "-"} ${record.message ?? ""}`);
}

export function logManualReview(record) {
  ensureLogsDir();
  const enriched = { ts: new Date().toISOString(), level: "warn", status: "MANUAL_REVIEW", ...record };
  appendFileSync(
    resolve(config.logsDir, "manual-review.jsonl"),
    JSON.stringify(enriched) + "\n",
    "utf8",
  );
  logEvent({ level: "warn", task: record.task, message: "MANUAL_REVIEW", ...record });
}
