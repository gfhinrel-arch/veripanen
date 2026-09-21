import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { activeChain } from "./chain.js";
import { injectedWallet, walletConnectWallet, coinbaseWallet, trustWallet } from "@rainbow-me/rainbowkit/wallets";

// WalletConnect Cloud project id. Required ONLY for the WalletConnect QR flow.
// Injected browser wallets work without it, and we avoid the required-projectId
// crash by falling back to a syntactically valid placeholder.
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "0000000000000000000000000000000";

// `metaMaskWallet`/`bitgetWallet` build on the MetaMask SDK connector, whose
// spread wrapper drops `getChainId` in wagmi 2.19.x and then throws
// "connection.connector.getChainId is not a function" on the first write.
// `injectedWallet` talks to the extension directly and is unaffected.
export const wagmiConfig = getDefaultConfig({
  appName: "VeriPanen",
  projectId,
  chains: [activeChain],
  ssr: false,
  wallets: [
    {
      groupName: "Recommended",
      wallets: [injectedWallet],
    },
    {
      groupName: "More",
      wallets: [trustWallet, coinbaseWallet, walletConnectWallet],
    },
  ],
});
