import { useCallback, useMemo, useState } from "react"
import { TextNode } from "lexical"
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin"
import { $createPillNode, type PillData } from "../lib/PillNode"
import { TriggerMenuComponent } from "../components/TriggerMenu"

export class PillOption extends MenuOption {
  data: PillData

  constructor(data: PillData) {
    super(data.label)
    this.data = data
  }
}

const MENTION_ITEMS: PillData[] = [
  { kind: "file", label: "README.md", payload: { path: "/README.md", description: "Project readme" } },
  { kind: "file", label: "package.json", payload: { path: "/package.json", description: "Dependencies" } },
  { kind: "file", label: "tsconfig.json", payload: { path: "/tsconfig.json", description: "TypeScript config" } },
  { kind: "file", label: "src/index.ts", payload: { path: "/src/index.ts", description: "Entry point" } },
  { kind: "symbol", label: "PillNode", payload: { type: "class", file: "PillNode.tsx" } },
  { kind: "symbol", label: "Composer", payload: { type: "component", file: "Composer.tsx" } },
  { kind: "mention", label: "alice", payload: { userId: "u1", role: "admin" } },
  { kind: "mention", label: "bob", payload: { userId: "u2", role: "member" } },
  { kind: "url", label: "github.com/lexical", payload: { href: "https://github.com/facebook/lexical" } },
  { kind: "url", label: "docs.example.com", payload: { href: "https://docs.example.com" } },
]

const COMMAND_ITEMS: PillData[] = [
  { kind: "command", label: "search", payload: { action: "search", description: "Search the codebase" } },
  { kind: "command", label: "edit", payload: { action: "edit", description: "Edit a file" } },
  { kind: "command", label: "run", payload: { action: "run", description: "Run a command" } },
  { kind: "command", label: "explain", payload: { action: "explain", description: "Explain code" } },
  { kind: "command", label: "test", payload: { action: "test", description: "Run tests" } },
  { kind: "command", label: "commit", payload: { action: "commit", description: "Create a commit" } },
  { kind: "command", label: "diff", payload: { action: "diff", description: "Show changes" } },
  { kind: "command", label: "help", payload: { action: "help", description: "Show help" } },
]

function useTriggerItems(trigger: "@" | "/", query: string | null): PillOption[] {
  return useMemo(() => {
    const items = trigger === "@" ? MENTION_ITEMS : COMMAND_ITEMS
    if (query === null) return []
    const q = query.toLowerCase()
    return items
      .filter((item) => item.label.toLowerCase().includes(q))
      .map((item) => new PillOption(item))
  }, [trigger, query])
}

function MentionTriggerPlugin() {
  const [query, setQuery] = useState<string | null>(null)
  const triggerFn = useBasicTypeaheadTriggerMatch("@", { minLength: 0 })
  const options = useTriggerItems("@", query)

  const onSelectOption = useCallback(
    (option: PillOption, textNode: TextNode | null, closeMenu: () => void) => {
      if (textNode) {
        const pillNode = $createPillNode(option.data)
        textNode.replace(pillNode)
      }
      closeMenu()
    },
    [],
  )

  return (
    <LexicalTypeaheadMenuPlugin<PillOption>
      onQueryChange={setQuery}
      onSelectOption={onSelectOption}
      triggerFn={triggerFn}
      options={options}
      menuRenderFn={(anchorElementRef, { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex, options: opts }) => (
        <TriggerMenuComponent
          anchorElementRef={anchorElementRef}
          options={opts}
          selectedIndex={selectedIndex}
          selectOptionAndCleanUp={selectOptionAndCleanUp}
          setHighlightedIndex={setHighlightedIndex}
        />
      )}
    />
  )
}

function CommandTriggerPlugin() {
  const [query, setQuery] = useState<string | null>(null)
  const triggerFn = useBasicTypeaheadTriggerMatch("/", { minLength: 0 })
  const options = useTriggerItems("/", query)

  const onSelectOption = useCallback(
    (option: PillOption, textNode: TextNode | null, closeMenu: () => void) => {
      if (textNode) {
        const pillNode = $createPillNode(option.data)
        textNode.replace(pillNode)
      }
      closeMenu()
    },
    [],
  )

  return (
    <LexicalTypeaheadMenuPlugin<PillOption>
      onQueryChange={setQuery}
      onSelectOption={onSelectOption}
      triggerFn={triggerFn}
      options={options}
      menuRenderFn={(anchorElementRef, { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex, options: opts }) => (
        <TriggerMenuComponent
          anchorElementRef={anchorElementRef}
          options={opts}
          selectedIndex={selectedIndex}
          selectOptionAndCleanUp={selectOptionAndCleanUp}
          setHighlightedIndex={setHighlightedIndex}
        />
      )}
    />
  )
}

export function TriggerMenuPlugins() {
  return (
    <>
      <MentionTriggerPlugin />
      <CommandTriggerPlugin />
    </>
  )
}
