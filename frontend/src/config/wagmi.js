import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { bnbTestnet } from "./chain.js";
import { metaMaskWallet, bitgetWallet, injectedWallet, walletConnectWallet, coinbaseWallet, trustWallet } from "@rainbow-me/rainbowkit/wallets";

// WalletConnect Cloud project id. Required ONLY for the WalletConnect QR flow.
// Injected browser wallets work without it, and we avoid the required-projectId
// crash by falling back to a syntactically valid placeholder.
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "0000000000000000000000000000000";

export const wagmiConfig = getDefaultConfig({
  appName: "VeriPanen",
  projectId,
  chains: [bnbTestnet],
  ssr: false,
  wallets: [
    {
      groupName: "Recommended",
      wallets: [metaMaskWallet, bitgetWallet, injectedWallet],
    },
    {
      groupName: "More",
      wallets: [trustWallet, coinbaseWallet, walletConnectWallet],
    },
  ],
});
