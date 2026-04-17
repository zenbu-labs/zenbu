import { useState, useCallback, useEffect, useRef } from "react";
import { nanoid } from "nanoid";
import {
  CheckIcon,
  ChevronsUpDownIcon,
  ChevronRightIcon,
  PuzzleIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Separator } from "../../../components/ui/separator";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../../components/ui/command";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { cn } from "../../../lib/utils";
import { useDb } from "../../../lib/kyju-react";
import { useKyjuClient, useRpc } from "../../../lib/providers";

function useIconUrl(client: any, blobId: string | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blobId) {
      setUrl(null);
      return;
    }
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
  return url;
}

type Section = "general" | "plugins";

export function SettingsDialog({
  open,
  onOpenChange,
  initialSection,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSection?: Section;
}) {
  const [section, setSection] = useState<Section>(initialSection ?? "plugins");

  useEffect(() => {
    if (open && initialSection) setSection(initialSection);
  }, [open, initialSection]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[85vw] sm:max-w-[85vw] h-[75vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <div className="flex flex-1 min-h-0">
          <nav className="w-[140px] shrink-0 border-r border-border bg-muted/30 p-2 space-y-0.5">
            <SidebarItem
              label="Plugins"
              active={section === "plugins"}
              onClick={() => setSection("plugins")}
            />
            <SidebarItem
              label="Agents"
              active={section === "general"}
              onClick={() => setSection("general")}
            />
          </nav>
          <div className="flex-1 min-w-0 overflow-y-auto">
            {section === "general" && <GeneralSection />}
            {section === "plugins" && <PluginsSection />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SidebarItem({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center rounded-md px-2.5 py-1.5 text-sm transition-colors",
        active
          ? "bg-foreground/10 text-foreground font-medium"
          : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function GeneralSection() {
  const configs = useDb((root) => root.plugin.kernel.agentConfigs);
  const selectedConfigId = useDb((root) => root.plugin.kernel.selectedConfigId);
  const client = useKyjuClient();

  const agentList = configs ?? [];
  const currentAgent = agentList.find((a) => a.id === selectedConfigId);

  const [comboOpen, setComboOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(currentAgent?.name ?? "");
  const [editCommand, setEditCommand] = useState(
    currentAgent?.startCommand ?? "",
  );
  const [addName, setAddName] = useState("");
  const [addCommand, setAddCommand] = useState("");

  useEffect(() => {
    setEditName(currentAgent?.name ?? "");
    setEditCommand(currentAgent?.startCommand ?? "");
    setEditOpen(false);
  }, [currentAgent?.id]);

  const setConfigs = useCallback(
    async (
      next: ReturnType<(typeof client.plugin.kernel.agentConfigs)["read"]>,
    ) => {
      await client.plugin.kernel.agentConfigs.set(next);
    },
    [client],
  );

  const setSelected = useCallback(
    async (id: string) => {
      await client.plugin.kernel.selectedConfigId.set(id);
    },
    [client],
  );

  const iconUrl = useIconUrl(client, currentAgent?.iconBlobId);
  const iconInputRef = useRef<HTMLInputElement>(null);

  const handleIconUpload = useCallback(
    async (file: File) => {
      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);
      const blobId = await (client as any).createBlob(data, true);
      await setConfigs(
        agentList.map((a) =>
          a.id === currentAgent?.id ? { ...a, iconBlobId: blobId } : a,
        ),
      );
    },
    [client, agentList, currentAgent?.id, setConfigs],
  );

  const handleRemoveIcon = useCallback(async () => {
    await setConfigs(
      agentList.map((a) => {
        if (a.id !== currentAgent?.id) return a;
        const { iconBlobId: _, ...rest } = a as any;
        return rest;
      }),
    );
  }, [agentList, currentAgent?.id, setConfigs]);

  const saveCurrentAgent = useCallback(async () => {
    if (!currentAgent || !editName.trim()) return;
    await setConfigs(
      agentList.map((a) =>
        a.id === currentAgent.id
          ? { ...a, name: editName.trim(), startCommand: editCommand.trim() }
          : a,
      ),
    );
  }, [currentAgent, editName, editCommand, agentList, setConfigs]);

  const handleDelete = useCallback(async () => {
    if (!currentAgent) return;
    const next = agentList.filter((a) => a.id !== currentAgent.id);
    await setConfigs(next);
    if (next.length > 0) {
      await setSelected(next[0].id);
    }
  }, [currentAgent, agentList, setConfigs, setSelected]);

  const handleAdd = useCallback(async () => {
    const name = addName.trim();
    const command = addCommand.trim();
    if (!name || !command) return;

    const id = nanoid();
    await setConfigs([...agentList, { id, name, startCommand: command, availableModels: [], availableThinkingLevels: [], availableModes: [] }]);
    await setSelected(id);
    setAddName("");
    setAddCommand("");
  }, [addName, addCommand, agentList, setConfigs, setSelected]);

  return (
    <div className="p-5 space-y-5">
      <div>
        <h2 className="text-base font-semibold">General</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure which agent process is spawned for new chats.
        </p>
      </div>

      <Separator />

      <div className="space-y-3">
        <p className="text-sm font-medium">Agent</p>

        <Popover open={comboOpen} onOpenChange={setComboOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={comboOpen}
              className="w-full justify-between font-normal"
            >
              {currentAgent?.name ?? "Select an agent..."}
              <ChevronsUpDownIcon className="opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-(--radix-popover-trigger-width) p-0"
            align="start"
          >
            <Command>
              <CommandInput placeholder="Search agents..." />
              <CommandList>
                <CommandEmpty>No agents found.</CommandEmpty>
                <CommandGroup>
                  {agentList.map((agent) => (
                    <CommandItem
                      key={agent.id}
                      value={agent.name}
                      onSelect={() => {
                        setSelected(agent.id);
                        setComboOpen(false);
                      }}
                    >
                      <span className="flex-1">{agent.name}</span>
                      <CheckIcon
                        className={cn(
                          "size-4",
                          agent.id === selectedConfigId
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

        {currentAgent && (
          <Collapsible open={editOpen} onOpenChange={setEditOpen}>
            <CollapsibleTrigger className="flex w-full items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ChevronRightIcon
                className={cn(
                  "size-4 transition-transform",
                  editOpen && "rotate-90",
                )}
              />
              Edit agent
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 space-y-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Name"
                  onBlur={saveCurrentAgent}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveCurrentAgent();
                  }}
                />
                <Input
                  value={editCommand}
                  onChange={(e) => setEditCommand(e.target.value)}
                  placeholder="Start command"
                  onBlur={saveCurrentAgent}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveCurrentAgent();
                  }}
                />
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">
                    Icon (SVG)
                  </label>
                  <div className="flex items-center gap-2">
                    {iconUrl ? (
                      <img
                        src={iconUrl}
                        alt=""
                        className="size-6 rounded object-contain"
                      />
                    ) : (
                      <div className="flex size-6 items-center justify-center rounded border border-dashed border-neutral-300 text-[10px] text-neutral-400">
                        ?
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => iconInputRef.current?.click()}
                    >
                      {iconUrl ? "Change" : "Upload"}
                    </Button>
                    {iconUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground"
                        onClick={handleRemoveIcon}
                      >
                        Remove
                      </Button>
                    )}
                    <input
                      ref={iconInputRef}
                      type="file"
                      accept=".svg,image/svg+xml"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleIconUpload(file);
                        e.target.value = "";
                      }}
                    />
                  </div>
                </div>
                <Button variant="destructive" size="sm" onClick={handleDelete}>
                  Delete agent
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      <Separator />

      <div className="space-y-3">
        <p className="text-sm font-medium">Add agent</p>
        <div className="space-y-2">
          <Input
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            placeholder="Name"
            onKeyDown={(e) => {
              if (e.key === "Enter" && addName.trim() && addCommand.trim())
                handleAdd();
            }}
          />
          <Input
            value={addCommand}
            onChange={(e) => setAddCommand(e.target.value)}
            placeholder="Start command"
            onKeyDown={(e) => {
              if (e.key === "Enter" && addName.trim() && addCommand.trim())
                handleAdd();
            }}
          />
        </div>
        <Button
          variant="outline"
          className="w-full"
          onClick={handleAdd}
          disabled={!addName.trim() || !addCommand.trim()}
        >
          Add agent
        </Button>
      </div>

      <Separator />

      <SummarizationSection />
    </div>
  );
}

function SummarizationSection() {
  const configs = useDb((root) => root.plugin.kernel.agentConfigs) ?? [];
  const currentConfigId = useDb(
    (root) => root.plugin.kernel.summarizationAgentConfigId,
  );
  const currentModel = useDb((root) => root.plugin.kernel.summarizationModel);
  const client = useKyjuClient();

  const selectedConfig = configs.find((c) => c.id === currentConfigId);
  const availableModels = selectedConfig?.availableModels ?? [];

  const setConfigId = useCallback(
    async (value: string) => {
      const next = value === "__none__" ? null : value;
      await client.plugin.kernel.summarizationAgentConfigId.set(next);
      await client.plugin.kernel.summarizationModel.set(null);
    },
    [client],
  );

  const setModel = useCallback(
    async (value: string) => {
      const next = value === "__default__" ? null : value;
      await client.plugin.kernel.summarizationModel.set(next);
    },
    [client],
  );

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">Title summarization</p>
        <p className="text-xs text-muted-foreground">
          Automatically generate short titles for new chats.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Agent</label>
        <Select
          value={currentConfigId ?? "__none__"}
          onValueChange={setConfigId}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Disabled" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Disabled</SelectItem>
            {configs.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {currentConfigId && (
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Model</label>
          <Select
            value={currentModel ?? "__default__"}
            onValueChange={setModel}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Use agent default" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default__">Use agent default</SelectItem>
              {availableModels.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

type PluginEntry = {
  manifestPath: string;
  name: string;
  enabled: boolean;
};

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-4 w-7 flex-none items-center rounded-full transition-colors ${
        checked ? "bg-neutral-400" : "bg-neutral-300"
      }`}
    >
      <span
        className={`inline-block h-3 w-3 rounded-full bg-white transition-transform ${
          checked ? "translate-x-3.5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function PluginsSection() {
  const rpc = useRpc();
  const [plugins, setPlugins] = useState<PluginEntry[]>([]);
  const [draft, setDraft] = useState<Map<string, boolean>>(new Map());

  const fetchPlugins = useCallback(async () => {
    const list: PluginEntry[] = await (
      rpc as any
    ).installer.listPluginsWithStatus();
    setPlugins(list);
    setDraft(new Map());
  }, [rpc]);

  useEffect(() => {
    fetchPlugins();
  }, [fetchPlugins]);

  const toggleDraft = (manifestPath: string, currentEnabled: boolean) => {
    setDraft((prev) => {
      const next = new Map(prev);
      const original =
        plugins.find((p) => p.manifestPath === manifestPath)?.enabled ?? false;
      const newValue = !currentEnabled;
      if (newValue === original) {
        next.delete(manifestPath);
      } else {
        next.set(manifestPath, newValue);
      }
      return next;
    });
  };

  const hasChanges = draft.size > 0;

  const handleSave = async () => {
    for (const [manifestPath, enabled] of draft) {
      await (rpc as any).installer.togglePlugin(manifestPath, enabled);
    }
    await fetchPlugins();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-background p-5 pb-0 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Plugins</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage installed plugins.
            </p>
          </div>
          {hasChanges && (
            <div className="flex gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDraft(new Map())}
                className="text-xs"
              >
                Discard
              </Button>
              <Button size="sm" onClick={handleSave} className="text-xs">
                Save
              </Button>
            </div>
          )}
        </div>

        <Separator />
      </div>

      {plugins.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <PuzzleIcon className="size-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No plugins found</p>
        </div>
      ) : (
        <div className="space-y-1 p-5 pt-3">
          {plugins.map((plugin) => {
            const isEnabled = draft.has(plugin.manifestPath)
              ? draft.get(plugin.manifestPath)!
              : plugin.enabled;
            const isChanged = draft.has(plugin.manifestPath);
            return (
              <div
                key={plugin.manifestPath}
                className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-muted/40"
              >
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm truncate ${
                      isChanged ? "text-foreground" : "text-foreground/80"
                    }`}
                  >
                    {plugin.name}
                  </div>
                </div>
                <Toggle
                  checked={isEnabled}
                  onChange={() => toggleDraft(plugin.manifestPath, isEnabled)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
