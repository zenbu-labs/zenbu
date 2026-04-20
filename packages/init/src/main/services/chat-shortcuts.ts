import { Service, runtime } from "../runtime";
import { ShortcutService } from "./shortcut";

export class ChatShortcutsService extends Service {
  static key = "chat-shortcuts";
  static deps = { shortcut: ShortcutService };
  declare ctx: { shortcut: ShortcutService };

  evaluate() {
    this.effect("register:interrupt", () =>
      this.ctx.shortcut.register({
        id: "chat.interrupt",
        defaultBinding: "ctrl+c",
        description: "Interrupt the streaming agent response",
        scope: "chat",
      }),
    );

    this.effect("register:openMode", () =>
      this.ctx.shortcut.register({
        id: "chat.openMode",
        defaultBinding: "cmd+/",
        description: "Open the mode / permissions picker",
        scope: "chat",
      }),
    );
  }
}

runtime.register(ChatShortcutsService, (import.meta as any).hot);
