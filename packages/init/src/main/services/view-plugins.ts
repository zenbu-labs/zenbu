import { Service, runtime } from "../runtime"
import { ViewRegistryService } from "./view-registry"
import { CoreRendererService } from "./core-renderer"

/**
 * Aliases the "plugins" and "new-agent" scopes onto the core renderer's
 * Vite server (the same server that serves orchestrator + chat). Each
 * scope is just a path on the shared server, no extra Vite instance.
 */
export class PluginsViewService extends Service {
  static key = "plugins-view"
  static deps = {
    viewRegistry: ViewRegistryService,
    coreRenderer: CoreRendererService,
  }
  declare ctx: {
    viewRegistry: ViewRegistryService
    coreRenderer: CoreRendererService
  }

  evaluate() {
    this.ctx.viewRegistry.registerAlias("plugins", "core", "/views/plugins")
    this.ctx.viewRegistry.registerAlias("new-agent", "core", "/views/new-agent")
    this.ctx.viewRegistry.registerAlias(
      "workspace",
      "core",
      "/views/workspace",
    )
  }
}

runtime.register(PluginsViewService, (import.meta as any).hot)
