import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { watch: { ignored: ["**/data/**", "**/.cache/**", "**/.cert/**"] } },
  build: { target: "es2022" },
  // Pre-bundle up front so the first page load doesn't trigger a re-optimise reload (two Reacts).
  optimizeDeps: { include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"] },
});
