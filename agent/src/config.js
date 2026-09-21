import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

function loadDotEnv() {
  const path = resolve(rootDir, ".env");
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv();

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function optional(name, fallback) {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

const MIN_CONFIDENCE_DEFAULT = 70;

/**
 * Parses MIN_CONFIDENCE. The blueprint requires a threshold of 70; only a
 * deliberate override may lower it, and that always warns because it weakens the
 * on-chain guard against low-confidence AI results.
 */
export function resolveMinConfidence(raw = process.env.MIN_CONFIDENCE) {
  if (raw === undefined || raw === "") return MIN_CONFIDENCE_DEFAULT;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    process.stderr.write(
      `WARNING: MIN_CONFIDENCE="${raw}" is invalid (expected a number in 0-100). Falling back to ${MIN_CONFIDENCE_DEFAULT}.\n`,
    );
    return MIN_CONFIDENCE_DEFAULT;
  }
  if (value < MIN_CONFIDENCE_DEFAULT) {
    process.stderr.write(
      `WARNING: MIN_CONFIDENCE is below ${MIN_CONFIDENCE_DEFAULT}.\n` +
        "This value is intended for demo/testing only and does not match the VeriPanen blueprint requirement.\n",
    );
  }
  return value;
}

export const config = {
  rootDir,

  ai: {
    // 9router gateway is OpenAI-compatible. Base URL ends with /v1.
    // The gateway intermittently returns 502/503 per model, so we rotate across
    // a list of verified vision-capable models until one succeeds.
    baseUrl: optional("GLM_BASE_URL", "https://api.thirtystore.com/v1"),
    apiKey: optional("GLM_API_KEY", ""),
    models: optional(
      "GLM_MODELS",
      [
        "thirty/deepseek-v4-pro",
        "thirty/deepseek-v4.1-flash",
        "thirty/gpt-5.5",
        "thirty/gpt-5.6-terra",
        "thirty/kimi-k3",
        "thirty/glm-5v-turbo",
        "thirty/minimax-m3",
      ].join(","),
    )
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean),
    temperature: Number(optional("GLM_TEMPERATURE", "0.1")),
    maxRetries: Number(optional("GLM_MAX_RETRIES", "3")),
    backoffMs: Number(optional("GLM_BACKOFF_MS", "1500")),
    timeoutMs: Number(optional("GLM_TIMEOUT_MS", "90000")),
  },

  minConfidence: resolveMinConfidence(),

  chain: {
    rpcUrl: required("BNB_TESTNET_RPC_URL"),
    chainId: Number(optional("CHAIN_ID", "97")),
    contractAddress: optional("CONTRACT_ADDRESS", ""),
    oraclePrivateKey: required("ORACLE_PRIVATE_KEY"),
  },

  ipfs: {
    pinataJwt: optional("PINATA_JWT", ""),
    gateway: optional("IPFS_GATEWAY", "https://gateway.pinata.cloud/ipfs/"),
  },

  logsDir: resolve(rootDir, "logs"),
};

export function assertAiConfigured() {
  if (!config.ai.apiKey) throw new Error("GLM_API_KEY is not set");
}

export function assertChainConfigured() {
  if (!config.chain.contractAddress) throw new Error("CONTRACT_ADDRESS is not set");
  if (!config.chain.oraclePrivateKey) throw new Error("ORACLE_PRIVATE_KEY is not set");
}
