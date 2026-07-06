import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // motor-plantillas composer+draft persistence encadenan request build →
    // prepare → compose → SHA-256 + OpenXML validation; en aislamiento
    // ronda 8 s, pero al correr junto al resto de la suite (CPU compartida)
    // llega a >15 s. 5 s (default vitest) es claramente insuficiente.
    // Subido a 30 s para dar margen sin enmascarar regresiones reales.
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "bun:test": path.resolve(__dirname, "./src/test/bun-test-shim.ts"),
    },
  },
});
