import { Service, runtime } from "../runtime"
import { ViewRegistryService } from "./view-registry"
import { CoreRendererService } from "./core-renderer"

export class ChatViewService extends Service {
  static key = "view-chat"
  static deps = { viewRegistry: ViewRegistryService, coreRenderer: CoreRendererService }
  declare ctx: { viewRegistry: ViewRegistryService; coreRenderer: CoreRendererService }

  evaluate() {
    this.ctx.viewRegistry.registerAlias("chat", "core", "/views/chat")
  }
}

runtime.register(ChatViewService, (import.meta as any).hot)
