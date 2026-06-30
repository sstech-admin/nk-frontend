import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server proxies /api to the Node backend on :8000 (matches backend .env PORT)
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,          // expose on the local network so phones on the same Wi-Fi can open it
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:8000", changeOrigin: true }
    }
  }
});
