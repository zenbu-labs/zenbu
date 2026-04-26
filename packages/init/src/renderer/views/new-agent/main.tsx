import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./App"
import "./app.css"

// Re-forward kernel-registered shortcuts up to the orchestrator.
import "@/lib/shortcut-capture"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
