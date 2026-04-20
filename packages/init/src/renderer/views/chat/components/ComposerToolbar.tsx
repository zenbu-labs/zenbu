import { useCallback, useMemo, useState } from "react";
import { useDb, useCollection } from "../../../lib/kyju-react";
import { useRpc } from "../../../lib/providers";
import { useShortcut } from "../../../lib/shortcut-handler";
import {
  ChevronDownIcon,
  CopyIcon,
  FolderOpenIcon,
  FolderSyncIcon,
  StarIcon,
} from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function ChangeCwdItem({
  agentId,
}: {
  agentId: string;
  currentCwd: string;
}) {
  const rpc = useRpc();
  const onClick = useCallback(async () => {
    const dir = await rpc.window.pickDirectory();
    if (!dir) return;
    try {
      await rpc.agent.changeCwd(agentId, dir);
    } catch (err) {
      console.error("[cwd-selector] changeCwd failed", err);
    }
  }, [rpc, agentId]);
  return (
    <DropdownMenuItem className="text-xs" onClick={onClick}>
      <FolderSyncIcon className="size-3" />
      Change cwd
    </DropdownMenuItem>
  );
}

function ModeCombobox({
  options,
  currentValue,
  defaultValue,
  onSelect,
  onSetDefault,
}: {
  options: Array<{ value: string; name: string; description?: string }>;
  currentValue: string;
  defaultValue: string | undefined;
  onSelect: (value: string) => void;
  onSetDefault: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === currentValue);

  // Snapshot the active value at the moment the popover opens, and sort
  // that row to the top for this session. Intentionally not recomputed on
  // selection — keeping row positions stable while open avoids the layout
  // shift of the just-clicked row jumping to the top under the cursor.
  const [pinnedValue, setPinnedValue] = useState<string | null>(null);
  const sortedOptions = useMemo(() => {
    if (!pinnedValue) return options;
    const idx = options.findIndex((o) => o.value === pinnedValue);
    if (idx <= 0) return options;
    return [options[idx]!, ...options.slice(0, idx), ...options.slice(idx + 1)];
  }, [options, pinnedValue]);

  useShortcut("chat.openMode", () => {
    setPinnedValue(currentValue);
    setOpen(true);
  });

  return (
    <TooltipProvider delayDuration={600}>
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setPinnedValue(currentValue);
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          size="sm"
          className="h-6 shrink-0 justify-between gap-1 px-2 font-normal text-xs text-neutral-400 hover:text-neutral-600 shadow-none"
        >
          <span className="truncate">{selected?.name ?? currentValue}</span>
          <ChevronDownIcon className="size-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="end">
        <Command>
          <CommandInput placeholder="Search modes…" className="h-9" />
          <CommandList>
            <CommandEmpty>No match.</CommandEmpty>
            <CommandGroup>
              {sortedOptions.map((opt) => {
                const isActive = currentValue === opt.value;
                const isDefault = defaultValue === opt.value;
                return (
                  <CommandItem
                    key={opt.value}
                    value={`${opt.name} ${opt.description ?? ""} ${opt.value}`}
                    onSelect={() => {
                      onSelect(opt.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "group flex flex-col items-start gap-0.5 px-2 py-2",
                      isActive &&
                        "bg-neutral-100 data-[selected=true]:bg-neutral-100",
                    )}
                  >
                    <span className="flex w-full items-center gap-2">
                      <span
                        className={cn(
                          "flex-1 truncate text-sm",
                          isActive && "font-medium text-neutral-900",
                        )}
                      >
                        {opt.name}
                      </span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (!isDefault) onSetDefault(opt.value);
                            }}
                            className={cn(
                              "flex size-5 shrink-0 items-center justify-center rounded transition-opacity",
                              isDefault
                                ? "opacity-100 cursor-default"
                                : "opacity-0 group-hover:opacity-60 hover:!opacity-100",
                            )}
                          >
                            <StarIcon
                              className={cn(
                                "size-3.5",
                                isDefault
                                  ? "fill-yellow-400 text-yellow-500"
                                  : "text-neutral-400",
                              )}
                            />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          {isDefault
                            ? "Current default for new agents"
                            : "Set as default for new agents"}
                        </TooltipContent>
                      </Tooltip>
                    </span>
                    {opt.description ? (
                      <span className="line-clamp-2 w-full text-left text-xs text-muted-foreground">
                        {opt.description}
                      </span>
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
    </TooltipProvider>
  );
}

function ContextIndicator({ used, size }: { used: number; size: number }) {
  const fraction = Math.min(used / size, 1);
  const radius = 9;
  const stroke = 2.5;
  const circumference = 2 * Math.PI * radius;
  const filled = circumference * fraction;
  const gap = circumference - filled;

  const pct = Math.round(fraction * 100);
  const formatTokens = (n: number) =>
    n >= 1000000
      ? `${(n / 1000000).toFixed(n >= 10000000 ? 0 : 1)}m`
      : n >= 1000
      ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
      : String(n);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-neutral-100 cursor-pointer"
          title={`${pct}% context used`}
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            className="-rotate-90"
          >
            <circle
              cx="12"
              cy="12"
              r={radius}
              fill="none"
              stroke="#c4c4c4"
              strokeWidth={stroke}
            />
            <circle
              cx="12"
              cy="12"
              r={radius}
              fill="none"
              stroke={
                fraction > 0.9
                  ? "#ef4444"
                  : fraction > 0.7
                  ? "#f59e0b"
                  : "#737373"
              }
              strokeWidth={stroke}
              strokeDasharray={`${filled} ${gap}`}
              strokeLinecap="round"
            />
          </svg>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        className="w-auto px-3 py-2 text-xs"
      >
        <div className="flex items-center gap-1 text-neutral-600">
          <span className="font-medium text-neutral-900">
            {formatTokens(used)}
          </span>
          <span>/</span>
          <span>{formatTokens(size)} tokens</span>
          <span className="text-neutral-400">({pct}%)</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ComposerToolbar({ agentId }: { agentId: string }) {
  const rpc = useRpc();

  const agent = useDb((root) =>
    root.plugin.kernel.agents.find((a) => a.id === agentId),
  );
  const agentConfigs = useDb((root) => root.plugin.kernel.agentConfigs);
  const { items: events } = useCollection(agent?.eventLog);
  const usage = useMemo(() => {
    if (!events) return null;
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (
        e?.data?.kind === "session_update" &&
        e.data.update?.sessionUpdate === "usage_update" &&
        typeof e.data.update?.used === "number" &&
        typeof e.data.update?.size === "number"
      ) {
        return {
          used: e.data.update.used as number,
          size: e.data.update.size as number,
        };
      }
    }
    return null;
  }, [events]);

  const agentCwd = agent?.metadata?.cwd as string | undefined;

  const template = useMemo(
    () => agentConfigs?.find((c) => c.id === agent?.configId),
    [agentConfigs, agent?.configId],
  );
  const availableModes = template?.availableModes ?? [];
  const currentMode = agent?.mode ?? "";
  const defaultMode = template?.defaultConfiguration?.mode;
  const templateId = template?.id;

  const handleModeChange = useCallback(
    async (value: string) => {
      await rpc.agent.setConfigOption(agentId, "mode", value);
    },
    [rpc, agentId],
  );

  const handleSetDefaultMode = useCallback(
    async (value: string) => {
      if (!templateId) return;
      await rpc.agent.setDefaultConfigOption(templateId, "mode", value);
    },
    [rpc, templateId],
  );

  const showCwd = !!agentCwd;
  const showMode = availableModes.length > 0;
  const showBar = showCwd || showMode || !!usage;

  if (!showBar) return null;

  const cwdDisplayName = agentCwd ? agentCwd.split("/").pop() || agentCwd : "";

  return (
    <div className="mx-auto w-full max-w-[919px] px-[1.625rem] pb-2 flex items-center">
      {showCwd ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors truncate max-w-[200px]"
              title={agentCwd!}
            >
              {cwdDisplayName}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="min-w-[160px] text-xs"
          >
            <DropdownMenuItem
              className="text-xs"
              onClick={() => rpc.window.copyToClipboard(agentCwd!)}
            >
              <CopyIcon className="size-3" />
              Copy full path
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-xs"
              onClick={() => rpc.window.openInFinder(agentCwd!)}
            >
              <FolderOpenIcon className="size-3" />
              Open in Finder
            </DropdownMenuItem>
            <ChangeCwdItem agentId={agentId} currentCwd={agentCwd!} />
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div />
      )}
      <div className="ml-auto flex items-center gap-1">
        {showMode && (
          <ModeCombobox
            options={availableModes}
            currentValue={currentMode}
            defaultValue={defaultMode}
            onSelect={handleModeChange}
            onSetDefault={handleSetDefaultMode}
          />
        )}
        {usage && <ContextIndicator used={usage.used} size={usage.size} />}
      </div>
    </div>
  );
}
