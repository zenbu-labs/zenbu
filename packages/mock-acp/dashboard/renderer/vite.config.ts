import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { resolve } from "path"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
  server: {
    hmr: {
      protocol: "ws",
      host: "localhost",
    },
  },
  build: {
    rollupOptions: {
      input: {
        orchestrator: resolve(__dirname, "orchestrator/index.html"),
        "control-panel": resolve(__dirname, "views/control-panel/index.html"),
        "event-viewer": resolve(__dirname, "views/event-viewer/index.html"),
        "agent-state": resolve(__dirname, "views/agent-state/index.html"),
        "prompt-tester": resolve(__dirname, "views/prompt-tester/index.html"),
      },
    },
  },
})
