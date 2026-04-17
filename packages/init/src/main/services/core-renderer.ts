import path from "node:path"
import fs from "node:fs"
import { fileURLToPath } from "node:url"
import { Service, runtime } from "../runtime"
import { ReloaderService } from "./reloader"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rendererRoot = path.resolve(__dirname, "../../renderer")
const viteConfigPath = path.join(rendererRoot, "vite.config.ts")

export class CoreRendererService extends Service {
  static key = "reloader-shell"
  static deps = { reloader: ReloaderService }
  declare ctx: { reloader: ReloaderService }

  // what lol
  url = ""
  port = 0

  async evaluate() {
    const entry = await this.ctx.reloader.create(
      "core",
      rendererRoot,
      fs.existsSync(viteConfigPath) ? viteConfigPath : false,
    )
    this.url = entry.url
    this.port = entry.port
    console.log(`[core-renderer] ready at ${this.url}`)
  }
}

runtime.register(CoreRendererService, (import.meta as any).hot)
