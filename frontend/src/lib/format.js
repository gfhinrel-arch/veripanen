import { formatEther, formatUnits } from "viem";
import { EXPLORER_BASE, AGENT_URL } from "../config/chain.js";

export function shortAddress(address, size = 4) {
  if (!address || address.length < 10) return address || "";
  return `${address.slice(0, 2 + size)}…${address.slice(-size)}`;
}

export function formatPrice(priceWei) {
  if (priceWei === undefined || priceWei === null) return "—";
  return `${trimZeros(formatEther(BigInt(priceWei)))} tBNB`;
}

export function formatWeight(weightKg) {
  if (weightKg === undefined || weightKg === null) return "—";
  return `${formatUnits(BigInt(weightKg), 0)} kg`;
}

function trimZeros(value) {
  return value.includes(".") ? value.replace(/\.?0+$/, "") : value;
}

export function formatConfidence(confidence) {
  if (confidence === undefined || confidence === null) return "—";
  return `${formatUnits(BigInt(confidence), 0)}%`;
}

export function formatCountdown(deadlineSeconds) {
  const deadline = Number(deadlineSeconds) * 1000;
  const diff = deadline - Date.now();
  if (diff <= 0) return "deadline passed";

  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

export function formatDate(seconds) {
  if (!seconds) return "—";
  return new Date(Number(seconds) * 1000).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatBlockTime(seconds) {
  if (!seconds) return "—";
  return new Date(Number(seconds) * 1000).toISOString().slice(0, 19).replace("T", " ");
}

export function explorerTx(hash) {
  return EXPLORER_BASE ? `${EXPLORER_BASE}/tx/${hash}` : "";
}

export function explorerAddress(address) {
  return EXPLORER_BASE ? `${EXPLORER_BASE}/address/${address}` : "";
}

export function gatewayUrl(uri) {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) {
    return `https://gateway.pinata.cloud/ipfs/${uri.slice("ipfs://".length)}`;
  }
  // Locally stored photos live on the agent's disk. A browser page served over
  // http cannot load a file:// URL, so route it through the agent.
  if (uri.startsWith("file://")) {
    return `${AGENT_URL}/api/photo?uri=${encodeURIComponent(uri)}`;
  }
  return uri;
}
