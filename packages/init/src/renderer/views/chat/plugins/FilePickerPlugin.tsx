import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  TextNode,
  $createTextNode,
  $getNodeByKey,
  COMMAND_PRIORITY_CRITICAL,
  PASTE_COMMAND,
  KEY_DOWN_COMMAND,
} from "lexical";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createTokenNode,
  $isTokenNode,
} from "../lib/TokenNode";
import { FilePickerMenu } from "../components/FilePickerMenu";
import { useRpc } from "@/lib/providers";
import { useDb } from "@/lib/kyju-react";

type FileEntry = { path: string; name: string };

export class FileMenuOption extends MenuOption {
  data: FileEntry;

  constructor(entry: FileEntry) {
    super(entry.path);
    this.data = entry;
  }
}

function usePasteSuppression() {
  const [editor] = useLexicalComposerContext();
  const justPastedRef = useRef(false);

  useEffect(() => {
    const unregPaste = editor.registerCommand(
      PASTE_COMMAND,
      () => {
        justPastedRef.current = true;
        return false;
      },
      COMMAND_PRIORITY_CRITICAL,
    );

    const unregKey = editor.registerCommand(
      KEY_DOWN_COMMAND,
      () => {
        justPastedRef.current = false;
        return false;
      },
      COMMAND_PRIORITY_CRITICAL,
    );

    return () => {
      unregPaste();
      unregKey();
    };
  }, [editor]);

  return justPastedRef;
}

const MAX_RESULTS = 50;

export function FilePickerPlugin({
  menuOpenRef,
  agentId,
}: {
  menuOpenRef: React.RefObject<boolean>;
  agentId: string;
}) {
  const [editor] = useLexicalComposerContext();
  const rpc = useRpc();
  const [allFiles, setAllFiles] = useState<FileEntry[]>([]);
  const [query, setQuery] = useState<string | null>(null);
  const justPastedRef = usePasteSuppression();

  const agent = useDb((root) =>
    root.plugin.kernel.agents.find((a) => a.id === agentId),
  );
  const cwd = useMemo(() => {
    const c = agent?.metadata?.cwd;
    return typeof c === "string" ? c : undefined;
  }, [agent]);

  useEffect(() => {
    let cancelled = false;
    rpc["file-scanner"]
      .listFiles(cwd)
      .then((files: FileEntry[]) => {
        if (!cancelled) setAllFiles(files);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [rpc, cwd]);

  const baseTrigger = useBasicTypeaheadTriggerMatch("@", { minLength: 0 });

  const triggerFn = useCallback(
    (text: string, editorArg: any) => {
      if (justPastedRef.current) return null;
      return baseTrigger(text, editorArg);
    },
    [baseTrigger, justPastedRef],
  );

  const options = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    const filtered = q
      ? allFiles.filter(
          (f) =>
            f.path.toLowerCase().includes(q) ||
            f.name.toLowerCase().includes(q),
        )
      : allFiles;
    return filtered.slice(0, MAX_RESULTS).map((f) => new FileMenuOption(f));
  }, [query, allFiles]);

  useEffect(() => {
    menuOpenRef.current = options.length > 0;
    return () => {
      menuOpenRef.current = false;
    };
  }, [options.length, menuOpenRef]);

  const onSelectOption = useCallback(
    (
      option: FileMenuOption,
      textNode: TextNode | null,
      closeMenu: () => void,
    ) => {
      if (textNode) {
        const entry = option.data;
        // @-mention is a text-replacement op (swap the `@query` TextNode for
        // a pill), not an "insert at caret". We build the same `kind:"file"`
        // TokenPayload the bus would, but place it directly since the
        // typeahead plugin hands us the exact node to replace. The node
        // class and serialized shape end up identical to a bus-driven
        // insert.
        const node = $createTokenNode({
          kind: "file",
          title: entry.name,
          data: { path: entry.path, name: entry.name, content: "" },
          blobs: [],
        });
        const nodeKey = node.getKey();
        const spaceNode = $createTextNode(" ");
        textNode.replace(node);
        node.insertAfter(spaceNode);
        spaceNode.select();

        rpc["file-scanner"]
          .readFile(entry.path, cwd)
          .then((content: string) => {
            editor.update(() => {
              const existing = $getNodeByKey(nodeKey);
              if ($isTokenNode(existing)) {
                existing.setPayload({
                  kind: "file",
                  title: entry.name,
                  data: { path: entry.path, name: entry.name, content },
                  blobs: [],
                });
              }
            });
          })
          .catch(() => {});
      }
      closeMenu();
    },
    [rpc, editor, cwd],
  );

  return (
    <LexicalTypeaheadMenuPlugin<FileMenuOption>
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
        <FilePickerMenu
          anchorElementRef={anchorElementRef}
          options={opts}
          selectedIndex={selectedIndex}
          selectOptionAndCleanUp={selectOptionAndCleanUp}
          setHighlightedIndex={setHighlightedIndex}
        />
      )}
    />
  );
}
