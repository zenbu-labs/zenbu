export type SlashCommand = {
  id: string
  label: string
  insertText: string
  action?: "reload"
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: "reload",
    label: "Reload",
    insertText: "",
    action: "reload",
  },
]
