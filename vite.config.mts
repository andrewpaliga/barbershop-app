import { defineConfig } from "vite";
import { gadget } from "gadget-server/vite";
import { remixViteOptions } from "gadget-server/remix";
import { vitePlugin as remix } from "@remix-run/dev";

// Force rebuild to clear corrupted Vite cache
export default defineConfig({
  plugins: [gadget(), remix(remixViteOptions)],
  optimizeDeps: {
    force: true, // Force re-optimization to clear corrupted cache
  },
  server: {
    fs: {
      strict: false,
    },
  },
});