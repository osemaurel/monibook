import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Libraries change rarely: separate chunks stay cached between deployments.
const VENDOR_CHUNKS: Record<string, RegExp> = {
  react: /node_modules\/(react|react-dom|react-router|scheduler)\//,
  supabase: /node_modules\/@supabase\//,
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          return Object.entries(VENDOR_CHUNKS).find(([, pattern]) => pattern.test(id))?.[0];
        },
      },
    },
  },
});
