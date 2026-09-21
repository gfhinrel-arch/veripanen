import { useCallback } from "react";
import { useConfig } from "wagmi";
import { getAccount, getChainId } from "@wagmi/core";

import { activeChain } from "../config/chain.js";
import { runPreflight, describeTxError } from "./txGuard.js";

/**
 * Returns `{ guard, mapError }` for browser writes.
 *
 * `guard(context)` re-reads the live account and chain from the wallet provider
 * (wagmi's cached values can be stale right after a MetaMask switch) and throws
 * if the chain or account is wrong. `mapError(err)` turns a write failure into an
 * actionable message; callers still console.error the original for debugging.
 */
export function useWalletGuard() {
  const config = useConfig();

  const guard = useCallback(
    (context = "Transaksi") => {
      const { address, chainId } = getAccount(config);
      const liveChainId = getChainId(config) ?? chainId;
      try {
        return runPreflight({
          currentAddress: address,
          currentChainId: liveChainId,
          expectedChainId: activeChain.id,
        });
      } catch (err) {
        throw new Error(`${context} diblokir sebelum dikirim. ${err.message}`);
      }
    },
    [config],
  );

  const mapError = useCallback((err, context = "transaksi") => {
    console.error(`[${context}] write failed:`, err);
    return describeTxError(err).message;
  }, []);

  return { guard, mapError };
}
