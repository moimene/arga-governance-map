import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  // F4.G10 — code-splitting & chunk-size budget.
  // Concilio K8: línea regulada española 2 Mbps = 6s para el chunk de 1.55 MB.
  // manualChunks parte por vendor para que el cache del navegador sea reutilizable.
  // chunkSizeWarningLimit baja a 500 KB para detectar regresiones futuras.
  build: {
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-supabase": ["@supabase/supabase-js", "@tanstack/react-query"],
          "vendor-handlebars": ["handlebars"],
          "vendor-xlsx": ["xlsx"],
          "vendor-zod": ["zod"],
          "vendor-docx": ["docx"],
        },
      },
    },
  },
}));
