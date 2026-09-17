import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // Older Safari / Telegram iOS WebView
    target: ["es2019", "safari13"],
  },
  server: {
    host: true,
    port: 5173,
  },
});
