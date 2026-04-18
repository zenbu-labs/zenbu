export type SlashCommand = {
  id: string
  label: string
  insertText: string
  action?: "reload-menu"
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: "reload",
    label: "Reload",
    insertText: "",
    action: "reload-menu",
  },
]
