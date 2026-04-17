import { MenuOption } from "@lexical/react/LexicalTypeaheadMenuPlugin"
import type { SlashCommand } from "./slash-commands"

export class SlashMenuOption extends MenuOption {
  data: SlashCommand

  constructor(data: SlashCommand) {
    super(data.id)
    this.data = data
  }
}
