import { defineChain } from "viem";

const RPC_URL =
  import.meta.env.VITE_BNB_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.bnbchain.org:8545";

// Anvil is the local development chain. When the RPC points at localhost we must
// target chain 31337, not 97, or every write fails with a chain-id mismatch.
// A tunnel exposes the same local Anvil over a public URL, so VITE_CHAIN_ID lets
// the operator state the chain explicitly instead of relying on the hostname.
const EXPLICIT_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || 0);
const IS_LOCAL =
  EXPLICIT_CHAIN_ID === 31337 ||
  /^https?:\/\/(127\.0\.0\.1|localhost)/.test(RPC_URL);

const CHAIN_ID = EXPLICIT_CHAIN_ID || (IS_LOCAL ? 31337 : 97);

const EXPLORER_LOCAL = { name: "Local", url: "http://127.0.0.1:8545" };
const EXPLORER_OPBNB = { name: "opBNB Testnet", url: "https://opbnb-testnet.bscscan.com" };
const EXPLORER_BSC = { name: "BscScan Testnet", url: "https://testnet.bscscan.com" };

const CHAIN_NAME = IS_LOCAL
  ? "Anvil Local"
  : CHAIN_ID === 5611
    ? "opBNB Testnet"
    : "BNB Smart Chain Testnet";

const EXPLORER = IS_LOCAL ? EXPLORER_LOCAL : CHAIN_ID === 5611 ? EXPLORER_OPBNB : EXPLORER_BSC;

export const activeChain = defineChain({
  id: CHAIN_ID,
  name: CHAIN_NAME,
  nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: EXPLORER },
  testnet: true,
});

export const isLocalChain = IS_LOCAL;

export const EXPLORER_BASE = IS_LOCAL ? "" : EXPLORER.url;

/** Kept as an alias so existing imports keep working. */
export const bnbTestnet = activeChain;

export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "";

export const AGENT_URL = import.meta.env.VITE_AGENT_URL || "http://localhost:8787";

export const STATUS = {
  0: { key: "Created", label: "Awaiting grade" },
  1: { key: "Graded", label: "Graded, open for funding" },
  2: { key: "Funded", label: "Escrow funded" },
  3: { key: "Shipped", label: "In transit" },
  4: { key: "Completed", label: "Completed" },
  5: { key: "Disputed", label: "Disputed" },
};

export const STATUS_TONE = {
  0: "neutral",
  1: "leaf",
  2: "amber",
  3: "amber",
  4: "leaf",
  5: "rust",
};
