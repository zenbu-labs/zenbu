import { createRoot } from "react-dom/client"
import { App } from "@zenbu/mock-acp/devtools/App"
import "@zenbu/mock-acp/devtools/styles.css"

createRoot(document.getElementById("root")!).render(<App />)
