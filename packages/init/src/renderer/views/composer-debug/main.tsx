console.log(`[composer-debug] main.tsx executing (${performance.now().toFixed(1)}ms since page start)`)

import { createRoot } from "react-dom/client"
import { App } from "./App"
import "./app.css"

createRoot(document.getElementById("root")!).render(<App />)
