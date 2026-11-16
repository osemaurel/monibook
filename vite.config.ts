import { readFileSync } from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// Libraries change rarely: separate chunks stay cached between deployments.
const VENDOR_CHUNKS: Record<string, RegExp> = {
  react: /node_modules\/(react|react-dom|react-router|scheduler)\//,
  supabase: /node_modules\/@supabase\//,
};

const pagedVersion = JSON.parse(readFileSync(path.resolve(__dirname, "node_modules/pagedjs/package.json"), "utf8")).version;
const PAGED_SCRIPT = `vendor/paged-${pagedVersion}.polyfill.min.js`;

/** Ships the Paged.js print script as a static file, loaded only by the PDF print tab. */
function pagedPrintScript(): Plugin {
  const source = path.resolve(__dirname, "node_modules/pagedjs/dist/paged.polyfill.min.js");
  return {
    name: "paged-print-script",
    configureServer(server) {
      server.middlewares.use(`/${PAGED_SCRIPT}`, (_req, res) => {
        res.setHeader("Content-Type", "text/javascript");
        res.end(readFileSync(source));
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: PAGED_SCRIPT, source: readFileSync(source) });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), pagedPrintScript()],
  define: { "import.meta.env.PAGED_SCRIPT_PATH": JSON.stringify(`/${PAGED_SCRIPT}`) },
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
