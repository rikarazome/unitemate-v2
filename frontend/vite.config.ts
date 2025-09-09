import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    postcss: "./postcss.config.js",
  },
  server: {
    host: true,
    allowedHosts: [
      "d7003278225f.ngrok-free.app",
      ".ngrok-free.app", // 他のngrok URLも許可
      "localhost",
      "127.0.0.1",
    ],
  },
});
