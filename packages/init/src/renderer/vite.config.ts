import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { resolve, join } from "path"
import { homedir } from "os"

const packagesDir = join(homedir(), ".zenbu", "plugins", "zenbu", "packages")

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: "@", replacement: resolve(__dirname, ".") },
      { find: "@testbu", replacement: packagesDir },
      // Tree-shaking shim for lucide-react. The barrel pulls in ~1.1MB of
      // icons because esbuild can't tree-shake through the optimizeDeps
      // entry. The shim re-exports only the icons we actually use, sourced
      // from lucide-react's per-icon files. Regex-anchored on the bare
      // specifier so deep imports (`lucide-react/dist/esm/icons/...`) inside
      // the shim still resolve normally to the real package.
      {
        find: /^lucide-react$/,
        replacement: resolve(__dirname, "./lib/lucide-shim.ts"),
      },
    ],
  },
  server: {
    warmup: {
      clientFiles: [
        "./views/orchestrator/main.tsx",
        "./views/chat/main.tsx",
      ],
    },
    hmr: {
      protocol: "ws",
      host: "localhost",
    },
  },
  build: {
    rollupOptions: {
      input: {
        orchestrator: resolve(__dirname, "views/orchestrator/index.html"),
        chat: resolve(__dirname, "views/chat/index.html"),
        "message-input": resolve(__dirname, "views/message-input/index.html"),
        quiz: resolve(__dirname, "views/quiz/index.html"),
        flashcard: resolve(__dirname, "views/flashcard/index.html"),
        heatmap: resolve(__dirname, "views/heatmap/index.html"),
        "composer-debug": resolve(__dirname, "views/composer-debug/index.html"),
      },
    },
  },
})
