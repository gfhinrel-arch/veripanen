import { defineChain } from "viem";

export const bnbTestnet = defineChain({
  id: 97,
  name: "BNB Smart Chain Testnet",
  nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
  rpcUrls: {
    default: {
      http: [import.meta.env.VITE_BNB_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.bnbchain.org:8545"],
    },
  },
  blockExplorers: {
    default: { name: "BscScan Testnet", url: "https://testnet.bscscan.com" },
  },
  testnet: true,
});

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
