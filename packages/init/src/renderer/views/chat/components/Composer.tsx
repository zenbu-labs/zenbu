import { useCallback, useRef, useEffect, useState, useMemo } from "react";
import { flushSync } from "react-dom";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  KEY_ENTER_COMMAND,
  COMMAND_PRIORITY_HIGH,
  $getRoot,
  $createParagraphNode,
} from "lexical";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { FileReferenceNode } from "../lib/FileReferenceNode";
import { ImageNode } from "../lib/ImageNode";
import { TokenNode } from "../lib/TokenNode";
import { FilePickerPlugin } from "../plugins/FilePickerPlugin";
import { ImagePastePlugin } from "../plugins/ImagePastePlugin";
import {
  DraftPersistencePlugin,
  getInitialEditorState,
  restoreChatBlobs,
} from "../plugins/DraftPersistencePlugin";
import { SlashCommandPlugin } from "../commands/SlashCommandPlugin";
import { ReloadMenu } from "../commands/ReloadMenu";
import { CtrlNPPlugin, NodeDeletePlugin } from "../plugins/KeyboardPlugins";
import { RichPastePlugin } from "../plugins/RichPastePlugin";
import { TokenInsertPlugin } from "../plugins/TokenInsertPlugin";
import { InsertBridgePlugin } from "../plugins/InsertBridgePlugin";
import { RefocusRehydratePlugin } from "../plugins/RefocusRehydratePlugin";
import { serializeEditorContent, type CollectedImage } from "../lib/serialize";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useRpc, useKyjuClient } from "../../../lib/providers";
import { useDb } from "../../../lib/kyju-react";
import { useShortcut } from "../../../lib/shortcut-handler";
import type { ExpectedVisibleMessage } from "../lib/chat-invariants";

type AgentConfigRow = {
  id: string;
  name: string;
  startCommand: string;
  availableModels: Array<{ value: string; name: string; description?: string }>;
  availableThinkingLevels: Array<{
    value: string;
    name: string;
    description?: string;
  }>;
  availableModes: Array<{ value: string; name: string; description?: string }>;
  iconBlobId?: string;
};

function AgentIcon({
  blobId,
  className,
}: {
  blobId: string;
  className?: string;
}) {
  const client = useKyjuClient();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoke: string | null = null;
    // fixme should not be any
    (client as any).getBlobData(blobId).then((data: Uint8Array | null) => {
      if (!data) return;
      const blob = new Blob([data as BlobPart], { type: "image/svg+xml" });
      revoke = URL.createObjectURL(blob);
      setUrl(revoke);
    });
    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [client, blobId]);
  if (!url) return null;
  return <img src={url} alt="" className={cn("object-contain", className)} />;
}

function SubmitPlugin({
  onSubmit,
  menuOpenRef,
  slashMenuOpenRef,
  reloadMenuOpenRef,
  externalMenuOpenRef,
}: {
  onSubmit: (
    text: string,
    images: CollectedImage[],
    editorStateJson: unknown,
  ) => void;
  menuOpenRef: React.RefObject<boolean>;
  slashMenuOpenRef: React.RefObject<boolean>;
  reloadMenuOpenRef: React.RefObject<boolean>;
  externalMenuOpenRef: React.RefObject<boolean>;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent | null) => {
        if (event?.shiftKey) return false;
        if (
          menuOpenRef.current ||
          slashMenuOpenRef.current ||
          reloadMenuOpenRef.current ||
          externalMenuOpenRef.current
        )
          return false;
        event?.preventDefault();
        // Snapshot the editor state JSON alongside the serialized text +
        // images so the user-message view can rehydrate pills — the raw
        // `text` alone is lossy (placeholders drop color/kind/data).
        const editorStateJson = editor.getEditorState().toJSON();
        editor.getEditorState().read(() => {
          const { text, images } = serializeEditorContent();
          if (text || images.length > 0) {
            onSubmit(text, images, editorStateJson);
            editor.update(() => {
              const root = $getRoot();
              root.clear();
              root.append($createParagraphNode());
            });
          }
        });
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor, onSubmit, menuOpenRef, slashMenuOpenRef, reloadMenuOpenRef, externalMenuOpenRef]);

  return null;
}

function AutoFocusPlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editor.focus();
    // TODO: this will be removed when focus system is implemented
    window.parent.postMessage({ type: "zenbu-iframe-ready" }, "*");
    const onFocus = () => editor.focus();
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "zenbu-focus-editor") editor.focus();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("message", onMessage);
    };
  }, [editor]);
  return null;
}

let _composerKey = 0;
if ((import.meta as any).hot) {
  _composerKey = ((import.meta as any).hot.data?._ck ?? -1) + 1;
  (import.meta as any).hot.data ??= {};
  (import.meta as any).hot.data._ck = _composerKey;
}

function makeEditorConfig(initialState: string | null) {
  return {
    namespace: "composer",
    onError: (error: Error) => console.error(error),
    nodes: [FileReferenceNode, ImageNode, TokenNode],
    ...(initialState ? { editorState: initialState } : {}),
  };
}

function ConfigCombobox({
  label,
  options,
  currentValue,
  onSelect,
  align = "start",
  className,
}: {
  label: string;
  options: Array<{ value: string; name: string; description?: string }>;
  currentValue: string;
  onSelect: (value: string) => void;
  align?: "start" | "end" | "center";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === currentValue);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          size="sm"
          className={cn(
            "h-8 min-w-30 max-w-40 shrink-0 justify-between gap-1 px-2.5 font-normal text-xs text-(--zenbu-composer-placeholder) hover:text-(--zenbu-composer-foreground) hover:bg-(--zenbu-control-hover) shadow-none",
            className,
          )}
          title={label}
        >
          <span className="truncate">{selected?.name ?? currentValue}</span>
          <ChevronDownIcon className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align={align}>
        <Command>
          <CommandInput
            placeholder={`Search ${label.toLowerCase()}…`}
            className="h-9"
          />
          <CommandList>
            <CommandEmpty>No match.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={`${opt.name} ${opt.description ?? ""} ${opt.value}`}
                  onSelect={() => {
                    onSelect(opt.value);
                    setOpen(false);
                  }}
                  className="flex flex-col items-start gap-0.5 py-2"
                >
                  <span className="flex w-full items-center gap-2">
                    <span className="flex-1 truncate text-sm">{opt.name}</span>
                    <CheckIcon
                      className={cn(
                        "size-4 shrink-0",
                        currentValue === opt.value
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                  </span>
                  {opt.description ? (
                    <span className="line-clamp-2 w-full text-left text-xs text-muted-foreground">
                      {opt.description}
                    </span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function AgentConfigCombobox({
  configs,
  currentConfigId,
  onSelect,
}: {
  configs: AgentConfigRow[];
  currentConfigId: string | undefined;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = configs.find((c) => c.id === currentConfigId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          size="sm"
          className="h-8 min-w-28 max-w-36 shrink-0 justify-between gap-1 px-2.5 font-normal text-xs text-(--zenbu-composer-placeholder) hover:text-(--zenbu-composer-foreground) hover:bg-(--zenbu-control-hover) shadow-none"
          title="Agent"
        >
          {current?.iconBlobId && (
            <AgentIcon
              blobId={current.iconBlobId}
              className="size-4 shrink-0"
            />
          )}
          <span className="truncate">{current?.name ?? "Agent…"}</span>
          <ChevronDownIcon className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search agents…" className="h-9" />
          <CommandList>
            <CommandEmpty>No agents found.</CommandEmpty>
            <CommandGroup>
              {configs.map((config) => (
                <CommandItem
                  key={config.id}
                  value={config.name}
                  onSelect={() => {
                    onSelect(config.id);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2"
                >
                  {config.iconBlobId && (
                    <AgentIcon
                      blobId={config.iconBlobId}
                      className="size-4 shrink-0"
                    />
                  )}
                  <span className="flex-1 truncate">{config.name}</span>
                  <CheckIcon
                    className={cn(
                      "size-4 shrink-0",
                      config.id === currentConfigId
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function Composer({
  agentId,
  scrollToBottom,
  debugExpectedVisibleMessageRef,
  slot,
  menuOpen,
  onSubmit,
}: {
  agentId: string;
  scrollToBottom?: () => void;
  debugExpectedVisibleMessageRef?: React.MutableRefObject<ExpectedVisibleMessage | null>;
  slot?: React.ReactNode;
  menuOpen?: boolean;
  /**
   * Override the default send path. When provided, Composer does its usual
   * draft clear + streaming-interrupt handling, then hands the serialized
   * message to `onSubmit` instead of writing to `eventLog` / calling
   * `rpc.agent.send` itself. The caller owns both writes.
   */
  onSubmit?: (
    text: string,
    images: CollectedImage[],
    editorStateJson: unknown,
  ) => Promise<void>;
}) {
  const filePickerOpenRef = useRef(false);
  const slashMenuOpenRef = useRef(false);
  const reloadMenuOpenRef = useRef(false);
  const externalMenuOpenRef = useRef(false);
  externalMenuOpenRef.current = menuOpen ?? false;
  const composerWrapperRef = useRef<HTMLDivElement | null>(null);
  const [reloadMenuOpen, setReloadMenuOpen] = useState(false);
  const rpc = useRpc();
  const client = useKyjuClient();

  const agentConfigs = useDb((root) => root.plugin.kernel.agentConfigs);
  const currentAgent = useDb((root) =>
    root.plugin.kernel.agents.find((a) => a.id === agentId),
  );
  const streaming = currentAgent?.status === "streaming";
  const template = agentConfigs.find((c) => c.id === currentAgent?.configId);
  const reloadMode: "continue" | "keep-alive" =
    currentAgent?.reloadMode === "continue" ? "continue" : "keep-alive";

  useEffect(() => {
    reloadMenuOpenRef.current = reloadMenuOpen;
  }, [reloadMenuOpen]);

  const initialEditorConfig = useMemo(
    () => makeEditorConfig(getInitialEditorState(client, agentId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agentId],
  );

  useEffect(() => {
    restoreChatBlobs(client, agentId);
  }, [agentId, client]);

  const handleSubmit = useCallback(
    async (
      text: string,
      images: CollectedImage[],
      editorStateJson: unknown,
    ) => {
      // Clear draft for this agent
      const drafts = client.plugin.kernel.composerDrafts.read() ?? {};
      if (drafts[agentId]) {
        const next = { ...drafts };
        delete next[agentId];
        client.plugin.kernel.composerDrafts.set(next);
      }

      console.log('sending', text);
      
      // if (streaming) {
      //   // Interrupt with prompt — server handles event log ordering
      //   // (interrupted event, then user_prompt, then sends to agent)
      //   try {
      //     console.log('interrupt');

      //     await rpc.agent.interrupt(
      //       agentId,
      //       text,
      //       images.length > 0 ? images : undefined,
      //     );
      //   } catch (err) {
      //     console.error("[composer] rpc.agent.interrupt failed", err);
      //   }
      //   if (images.length > 0) {
      //     client.plugin.kernel.chatBlobs.set([]).catch(() => {});
      //   }
      //   return;
      // }

      if (onSubmit) {
        try {
          await onSubmit(text, images, editorStateJson);
        } catch (err) {
          console.error("[composer] onSubmit override failed", err);
        }
        if (images.length > 0) {
          client.plugin.kernel.chatBlobs.set([]).catch(() => {});
        }
        return;
      }

      const agentIndex = client.plugin.kernel.agents
        .read()
        .findIndex((a) => a.id === agentId);
      if (agentIndex >= 0) {
        const agentNode = client.plugin.kernel.agents[agentIndex];
        const eventData: {
          kind: "user_prompt";
          text: string;
          images?: { blobId: string; mimeType: string }[];
          editorState?: unknown;
        } = {
          kind: "user_prompt",
          text,
          editorState: editorStateJson,
        };
        if (images.length > 0) {
          eventData.images = images.map((img) => ({
            blobId: img.blobId,
            mimeType: img.mimeType,
          }));
        }
        flushSync(() => {
          const now = Date.now();
          if (debugExpectedVisibleMessageRef) {
            debugExpectedVisibleMessageRef.current = {
              agentId,
              timestamp: now,
              createdAt: Date.now(),
              textPreview: text.slice(0, 120),
              imageCount: images.length,
            };
          }
          agentNode.eventLog.concat([
            { timestamp: now, data: eventData },
          ]);
          agentNode.status.set("streaming");
          agentNode.lastUserMessageAt?.set(now);
        });
      }

      const pending = client.plugin.kernel.composerPending.read()?.[agentId];
      try {
        await rpc.agent.send(
          agentId,
          text,
          images.length > 0 ? images : undefined,
          pending?.cwd ? { cwd: pending.cwd } : undefined,
        );
      } catch (err) {
        console.error("[composer] rpc.agent.send failed", err);
      }

      if (images.length > 0) {
        client.plugin.kernel.chatBlobs.set([]).catch(() => {});
      }
    },
    [rpc, agentId, client, streaming, debugExpectedVisibleMessageRef, onSubmit],
  );

  const handleConfigChange = useCallback(
    async (configId: string, value: string) => {
      await rpc.agent.setConfigOption(agentId, configId, value);
    },
    [rpc, agentId],
  );

  const handleInterrupt = useCallback(async () => {
    if (!streaming) return;
    try {
      await rpc.agent.interrupt(agentId);
    } catch (err) {
      console.error("[composer] rpc.agent.interrupt failed", err);
    }
  }, [rpc, agentId, streaming]);

  useShortcut("chat.interrupt", handleInterrupt);

  const handleSwitchAgentConfig = useCallback(
    async (newConfigId: string) => {
      await rpc.agent.changeAgentConfig(agentId, newConfigId);
    },
    [rpc, agentId],
  );

  return (
    <div className="mx-auto w-full max-w-[919px] px-4 pt-1 pb-3">
      <div
        ref={composerWrapperRef}
        className="relative overflow-visible rounded-lg border bg-(--zenbu-composer) text-(--zenbu-composer-foreground) border-(--zenbu-composer-border)"
      >
        <LexicalComposer
          key={`${_composerKey}-${agentId}`}
          initialConfig={initialEditorConfig}
        >
          <div className="relative">
            <PlainTextPlugin
              contentEditable={
                <ContentEditable
                  spellCheck={false}
                  className="min-h-[80px] max-h-[200px] overflow-y-auto px-5 pt-3 pb-3 text-sm text-(--zenbu-composer-foreground) outline-none caret-(--zenbu-composer-foreground)"
                />
              }
              placeholder={
                <div className="pointer-events-none absolute top-3 left-5 text-sm text-(--zenbu-composer-placeholder)">
                  / for commands, @ for context
                </div>
              }
              ErrorBoundary={({ children }) => <>{children}</>}
            />
          </div>
          <HistoryPlugin />
          <SubmitPlugin
            onSubmit={handleSubmit}
            menuOpenRef={filePickerOpenRef}
            slashMenuOpenRef={slashMenuOpenRef}
            reloadMenuOpenRef={reloadMenuOpenRef}
            externalMenuOpenRef={externalMenuOpenRef}
          />
          <AutoFocusPlugin />
          <FilePickerPlugin menuOpenRef={filePickerOpenRef} agentId={agentId} />
          <ImagePastePlugin agentId={agentId} />
          <TokenInsertPlugin agentId={agentId} />
          <InsertBridgePlugin agentId={agentId} />
          <DraftPersistencePlugin agentId={agentId} />
          <RefocusRehydratePlugin agentId={agentId} />
          <SlashCommandPlugin
            menuOpenRef={slashMenuOpenRef}
            agentId={agentId}
            onAction={(action) => {
              if (action === "reload-menu") {
                setReloadMenuOpen(true);
              }
            }}
          />
          <CtrlNPPlugin />
          <NodeDeletePlugin />
          <RichPastePlugin />
          {slot}
        </LexicalComposer>

        <ReloadMenu
          open={reloadMenuOpen}
          anchorEl={composerWrapperRef.current}
          reloadMode={reloadMode}
          onReloadAgent={async () => {
            try {
              await rpc.agent.reload(agentId);
            } catch (err) {
              console.error("[composer] reload failed", err);
            }
          }}
          onToggleHotReload={async () => {
            const next: "continue" | "keep-alive" =
              reloadMode === "keep-alive" ? "continue" : "keep-alive";
            try {
              await rpc.agent.setReloadMode(agentId, next);
            } catch (err) {
              console.error("[composer] setReloadMode failed", err);
            }
          }}
          onClose={() => setReloadMenuOpen(false)}
        />

        <div className="flex flex-wrap items-center gap-0.5 px-2 pb-1">
          {agentConfigs && agentConfigs.length > 0 && (
            <AgentConfigCombobox
              configs={agentConfigs}
              currentConfigId={currentAgent?.configId}
              onSelect={handleSwitchAgentConfig}
            />
          )}

          {template?.availableModels &&
            template.availableModels.length > 0 &&
            currentAgent?.model != null && (
              <ConfigCombobox
                label="Model"
                options={template.availableModels}
                currentValue={currentAgent.model}
                onSelect={(v) => handleConfigChange("model", v)}
              />
            )}

          {template?.availableThinkingLevels &&
            template.availableThinkingLevels.length > 0 &&
            currentAgent?.thinkingLevel != null && (
              <ConfigCombobox
                label="Thinking"
                className="max-w-44"
                options={template.availableThinkingLevels}
                currentValue={currentAgent.thinkingLevel}
                onSelect={(v) => handleConfigChange("reasoning_effort", v)}
              />
            )}

          {streaming && (
            <button
              type="button"
              className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:opacity-85"
              onClick={handleInterrupt}
              title="Interrupt (Esc / Ctrl+C)"
            >
              <div className="h-3 w-3 rounded-[2px] bg-current" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
