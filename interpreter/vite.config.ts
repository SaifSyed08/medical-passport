import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // ".." lets the app reuse the medical passport's rule-based document reader (extractor/src/rules.ts).
  server: { watch: { ignored: ["**/data/**", "**/.cache/**", "**/.cert/**"] }, fs: { allow: [".."] } },
  build: { target: "es2022" },
  // Plain CSS, no PostCSS. Without this, Vite walks up into medical-passport and loads the Site's Tailwind config.
  css: { postcss: { plugins: [] } },
  // Pre-bundle up front so the first page load doesn't trigger a re-optimise reload (two Reacts).
  optimizeDeps: { include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"] },
});
