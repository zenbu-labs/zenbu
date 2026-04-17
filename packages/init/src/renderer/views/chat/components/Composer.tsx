import { useCallback, useRef, useEffect, useState, useMemo } from "react";
import { flushSync } from "react-dom";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  COMMAND_PRIORITY_HIGH,
  $getRoot,
  $createParagraphNode,
} from "lexical";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { FileReferenceNode } from "../lib/FileReferenceNode";
import { ImageNode } from "../lib/ImageNode";
import { FilePickerPlugin } from "../plugins/FilePickerPlugin";
import { ImagePastePlugin } from "../plugins/ImagePastePlugin";
import {
  DraftPersistencePlugin,
  getInitialEditorState,
  restoreChatBlobs,
} from "../plugins/DraftPersistencePlugin";
import { SlashCommandPlugin } from "../commands/SlashCommandPlugin";
import { CtrlNPPlugin, NodeDeletePlugin } from "../plugins/KeyboardPlugins";
import { RichPastePlugin } from "../plugins/RichPastePlugin";
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
}: {
  onSubmit: (text: string, images: CollectedImage[]) => void;
  menuOpenRef: React.RefObject<boolean>;
  slashMenuOpenRef: React.RefObject<boolean>;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent | null) => {
        if (event?.shiftKey) return false;
        if (menuOpenRef.current || slashMenuOpenRef.current) return false;
        event?.preventDefault();
        editor.getEditorState().read(() => {
          const { text, images } = serializeEditorContent();
          if (text || images.length > 0) {
            onSubmit(text, images);
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
  }, [editor, onSubmit, menuOpenRef, slashMenuOpenRef]);

  return null;
}

function InterruptPlugin({ onInterrupt }: { onInterrupt: () => void }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const unregisterEsc = editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      () => {
        onInterrupt();
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );

    const root = editor.getRootElement();
    if (!root) return unregisterEsc;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "c" && (e.ctrlKey || e.metaKey)) {
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) return;
        e.preventDefault();
        onInterrupt();
      }
    };
    root.addEventListener("keydown", handleKeyDown);

    return () => {
      unregisterEsc();
      root.removeEventListener("keydown", handleKeyDown);
    };
  }, [editor, onInterrupt]);

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
    nodes: [FileReferenceNode, ImageNode],
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
            "h-8 min-w-[7.5rem] max-w-[10rem] shrink-0 justify-between gap-1 px-2.5 font-normal text-xs text-neutral-600 shadow-none",
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
          className="h-8 min-w-[7rem] max-w-[9rem] shrink-0 justify-between gap-1 px-2.5 font-normal text-xs text-neutral-600 shadow-none"
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
}: {
  agentId: string;
  scrollToBottom?: () => void;
}) {
  const filePickerOpenRef = useRef(false);
  const slashMenuOpenRef = useRef(false);
  const rpc = useRpc();
  const client = useKyjuClient();

  const agentConfigs = useDb((root) => root.plugin.kernel.agentConfigs);
  const agents = useDb((root) => root.plugin.kernel.agents);

  const currentAgent = agents?.find((a) => a.id === agentId);
  const streaming = currentAgent?.status === "streaming";
  const template = agentConfigs?.find((c) => c.id === currentAgent?.configId);

  const initialEditorConfig = useMemo(
    () => makeEditorConfig(getInitialEditorState(client, agentId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agentId],
  );

  useEffect(() => {
    restoreChatBlobs(client, agentId);
  }, [agentId, client]);

  const handleSubmit = useCallback(
    async (text: string, images: CollectedImage[]) => {
      // Clear draft for this agent
      const drafts = client.plugin.kernel.composerDrafts.read() ?? {};
      if (drafts[agentId]) {
        const next = { ...drafts };
        delete next[agentId];
        client.plugin.kernel.composerDrafts.set(next);
      }

      if (streaming) {
        // Interrupt with prompt — server handles event log ordering
        // (interrupted event, then user_prompt, then sends to agent)
        try {
          await rpc.agent.interrupt(
            agentId,
            text,
            images.length > 0 ? images : undefined,
          );
        } catch (err) {
          console.error("[composer] rpc.agent.interrupt failed", err);
        }
        if (images.length > 0) {
          client.plugin.kernel.chatBlobs.set([]).catch(() => {});
        }
        return;
      }

      const agents = client.plugin.kernel.agents.read();
      const agentIndex = agents?.findIndex((a) => a.id === agentId) ?? -1;

      if (agentIndex >= 0) {
        const eventData: {
          kind: "user_prompt";
          text: string;
          images?: { blobId: string; mimeType: string }[];
        } = {
          kind: "user_prompt",
          text,
        };
        if (images.length > 0) {
          eventData.images = images.map((img) => ({
            blobId: img.blobId,
            mimeType: img.mimeType,
          }));
        }
        flushSync(() => {
          const now = Date.now();
          client.plugin.kernel.agents[agentIndex].eventLog.concat([
            { timestamp: now, data: eventData },
          ]);
          client.plugin.kernel.agents[agentIndex].status.set("streaming");
          client.plugin.kernel.agents[agentIndex].lastUserMessageAt?.set(now);
        });
        scrollToBottom?.();
      }

      try {
        await rpc.agent.send(
          agentId,
          text,
          images.length > 0 ? images : undefined,
        );
      } catch (err) {
        console.error("[composer] rpc.agent.send failed", err);
      }

      if (images.length > 0) {
        client.plugin.kernel.chatBlobs.set([]).catch(() => {});
      }
    },
    [rpc, agentId, client, streaming, scrollToBottom],
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

  const handleSwitchAgentConfig = useCallback(
    async (newConfigId: string) => {
      await rpc.agent.changeAgentConfig(agentId, newConfigId);
    },
    [rpc, agentId],
  );

  return (
    <div className="mx-auto w-full max-w-[919px] px-4 pt-1 pb-3">
      <div className="overflow-hidden rounded-lg border border-neutral-300 bg-white/80">
        <LexicalComposer
          key={`${_composerKey}-${agentId}`}
          initialConfig={initialEditorConfig}
        >
          <div className="relative">
            <PlainTextPlugin
              contentEditable={
                <ContentEditable
                  spellCheck={false}
                  className="min-h-[80px] max-h-[200px] overflow-y-auto px-5 pt-3 pb-3 text-sm outline-none"
                />
              }
              placeholder={
                <div className="pointer-events-none absolute top-3 left-5 text-sm text-neutral-500">
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
          />
          <AutoFocusPlugin />
          <FilePickerPlugin menuOpenRef={filePickerOpenRef} />
          <ImagePastePlugin />
          <DraftPersistencePlugin agentId={agentId} />
          <SlashCommandPlugin
            menuOpenRef={slashMenuOpenRef}
            agentId={agentId}
            onAction={async (action, id) => {
              if (action === "reload") {
                try {
                  await rpc.agent.reload(id);
                } catch (err) {
                  console.error("[composer] reload failed", err);
                }
              }
            }}
          />
          <CtrlNPPlugin />
          <NodeDeletePlugin />
          <RichPastePlugin />
          {streaming && <InterruptPlugin onInterrupt={handleInterrupt} />}
        </LexicalComposer>

        <div className="flex flex-wrap items-center gap-0.5 px-2 pb-1">
          {agentConfigs && agentConfigs.length > 0 && (
            <AgentConfigCombobox
              configs={agentConfigs}
              currentConfigId={currentAgent?.configId}
              onSelect={handleSwitchAgentConfig}
            />
          )}

          {agentId === "mock-acp" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                rpc.agent.openAgentDevtools(agentId);
              }}
            >
              Devtools
            </Button>
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
                className="max-w-[11rem]"
                options={template.availableThinkingLevels}
                currentValue={currentAgent.thinkingLevel}
                onSelect={(v) => handleConfigChange("reasoning_effort", v)}
              />
            )}

          {streaming && (
            <button
              type="button"
              className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-neutral-900 hover:bg-black"
              onClick={handleInterrupt}
              title="Interrupt (Esc / Ctrl+C)"
            >
              <div className="h-3 w-3 rounded-[2px] bg-white" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
