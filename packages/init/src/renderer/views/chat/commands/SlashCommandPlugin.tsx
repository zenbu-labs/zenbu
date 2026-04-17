import React, { useCallback, useEffect, useMemo, useState } from "react"
import { TextNode, $createTextNode, $getRoot, $createParagraphNode } from "lexical"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import {
  LexicalTypeaheadMenuPlugin,
  useBasicTypeaheadTriggerMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin"
import { SlashCommandMenu } from "./SlashCommandMenu"
import { SLASH_COMMANDS } from "./slash-commands"
import { SlashMenuOption } from "./slash-menu-option"

const MAX_RESULTS = 50

export function SlashCommandPlugin({
  menuOpenRef,
  agentId,
  onAction,
}: {
  menuOpenRef: React.RefObject<boolean>
  agentId: string
  onAction: (action: string, agentId: string) => void
}) {
  const [editor] = useLexicalComposerContext()
  const [query, setQuery] = useState<string | null>(null)

  const triggerFn = useBasicTypeaheadTriggerMatch("/", { minLength: 0 })

  const options = useMemo(() => {
    if (query === null) return []
    const q = query.toLowerCase()
    const filtered = q
      ? SLASH_COMMANDS.filter(
          (c) =>
            c.label.toLowerCase().includes(q) ||
            c.id.toLowerCase().includes(q),
        )
      : SLASH_COMMANDS
    return filtered.slice(0, MAX_RESULTS).map((c) => new SlashMenuOption(c))
  }, [query])

  useEffect(() => {
    menuOpenRef.current = options.length > 0
    return () => {
      menuOpenRef.current = false
    }
  }, [options.length, menuOpenRef])

  const onSelectOption = useCallback(
    (
      option: SlashMenuOption,
      textNode: TextNode | null,
      closeMenu: () => void,
    ) => {
      if (option.data.action) {
        if (textNode) {
          editor.update(() => {
            const root = $getRoot()
            root.clear()
            root.append($createParagraphNode())
          })
        }
        closeMenu()
        onAction(option.data.action, agentId)
      } else {
        if (textNode) {
          const text = $createTextNode(option.data.insertText)
          textNode.replace(text)
          text.select()
        }
        closeMenu()
      }
    },
    [editor, agentId, onAction],
  )

  return (
    <LexicalTypeaheadMenuPlugin<SlashMenuOption>
      onQueryChange={setQuery}
      onSelectOption={onSelectOption}
      triggerFn={triggerFn}
      options={options}
      menuRenderFn={(
        anchorElementRef,
        {
          selectedIndex,
          selectOptionAndCleanUp,
          setHighlightedIndex,
          options: opts,
        },
      ) => (
        <SlashCommandMenu
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
