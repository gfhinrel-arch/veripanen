/**
 * Central wallet guard for every browser write transaction.
 *
 * Anvil resets its chain state on restart, MetaMask keeps stale accounts and
 * nonces, and the user can switch network or account at any moment. Every write
 * path routes through here so the failure is either prevented (wrong chain /
 * no account) or explained (nonce mismatch) before it reaches the RPC.
 */

export const NONCE_HINT =
  "Nonce tidak sinkron.\n" +
  "Jika kamu baru saja me-restart Anvil atau mengganti network/account, " +
  "reset activity & nonce data di MetaMask lalu coba lagi.";

const NONCE_PATTERNS = [
  /nonce too low/i,
  /nonce too high/i,
  /nonce mismatch/i,
  /replacement transaction underpriced/i,
  /already known/i,
  /known transaction/i,
  /transaction nonce/i,
];

/** True when the error text looks like a stale/mismatched wallet nonce. */
export function isNonceError(error) {
  const text = collectErrorText(error);
  return NONCE_PATTERNS.some((re) => re.test(text));
}

function collectErrorText(error) {
  if (!error) return "";
  const parts = [
    error.shortMessage,
    error.message,
    error.details,
    error.cause?.shortMessage,
    error.cause?.message,
    error.cause?.details,
    typeof error.data === "string" ? error.data : error.data?.message,
  ];
  return parts.filter(Boolean).join(" | ");
}

/**
 * Maps any write error to an actionable, user-facing message.
 * The original error is never swallowed: callers still log it for debugging.
 */
export function describeTxError(error) {
  if (isNonceError(error)) {
    return { kind: "nonce", message: NONCE_HINT };
  }
  if (error?.code === 4001 || /user rejected|denied/i.test(collectErrorText(error))) {
    return { kind: "rejected", message: "Transaksi dibatalkan di wallet." };
  }
  if (/insufficient funds/i.test(collectErrorText(error))) {
    return { kind: "funds", message: "Saldo tidak cukup untuk gas. Isi tBNB lalu coba lagi." };
  }
  const detail = error?.shortMessage || error?.message || "Transaksi gagal.";
  return { kind: "unknown", message: detail };
}

/** Throws a clear error when the wallet is on the wrong chain. */
export function assertExpectedChain(currentChainId, expectedChainId) {
  if (currentChainId === undefined || currentChainId === null) {
    throw new Error("Wallet belum terhubung. Connect wallet dulu.");
  }
  if (Number(currentChainId) !== Number(expectedChainId)) {
    throw new Error(
      `Network salah. Wallet ada di chain ${currentChainId}, aplikasi butuh chain ${expectedChainId}. ` +
        "Ganti network di wallet lalu coba lagi.",
    );
  }
}

/** Throws when no account is available for the write. */
export function assertAccountReady(address) {
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error("Tidak ada akun aktif. Connect wallet dulu.");
  }
}

/**
 * Full preflight. Re-reads the live account from the wallet provider so a stale
 * cached address is never used, then checks chain and account.
 *
 * @param {object} p
 * @param {number|undefined} p.currentChainId  live chain from the connector
 * @param {number} p.expectedChainId           app's active chain
 * @param {string|undefined} p.currentAddress  live account from the connector
 * @returns {{ address: string }}
 */
export function runPreflight({ currentChainId, expectedChainId, currentAddress }) {
  assertExpectedChain(currentChainId, expectedChainId);
  assertAccountReady(currentAddress);
  return { address: currentAddress };
}
