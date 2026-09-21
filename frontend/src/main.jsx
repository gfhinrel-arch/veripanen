import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";

import "@rainbow-me/rainbowkit/styles.css";
import "./index.css";

import { wagmiConfig } from "./config/wagmi.js";
import { AppShell } from "./components/AppShell.jsx";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
import { FarmerPage } from "./pages/FarmerPage.jsx";
import { BuyerPage } from "./pages/BuyerPage.jsx";
import { PublicPage } from "./pages/PublicPage.jsx";
import { ListingDetailPage } from "./pages/ListingDetailPage.jsx";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider
            modalSize="compact"
            theme={darkTheme({
              accentColor: "#279660",
              accentColorForeground: "#ffffff",
              borderRadius: "medium",
            })}
          >
            <BrowserRouter>
              <Routes>
                <Route element={<AppShell />}>
                  <Route path="/" element={<FarmerPage />} />
                  <Route path="/buyer" element={<BuyerPage />} />
                  <Route path="/ledger" element={<PublicPage />} />
                  <Route path="/listing/:id" element={<ListingDetailPage />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ErrorBoundary>
  </StrictMode>,
);
