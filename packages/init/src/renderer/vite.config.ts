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
      { find: "#zenbu", replacement: packagesDir },
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
        "new-agent": resolve(__dirname, "views/new-agent/index.html"),
        plugins: resolve(__dirname, "views/plugins/index.html"),
        workspace: resolve(__dirname, "views/workspace/index.html"),
      },
    },
  },
})
