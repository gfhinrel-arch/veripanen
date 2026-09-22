import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Dev server is reached through a cloudflared tunnel during demos; Vite
    // rejects unknown Host headers by default, so allow the tunnel domain.
    allowedHosts: [".trycloudflare.com"],
  },
});
