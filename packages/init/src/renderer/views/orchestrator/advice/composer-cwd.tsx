// will be a plugin
import { useCallback, useMemo, useState } from "react";
import { useDb, useCollection } from "../../../lib/kyju-react";
import { useRpc } from "../../../lib/providers";
import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  FolderOpenIcon,
  FolderSyncIcon,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type AgentRow = {
  id: string;
  configId?: string;
  model?: string;
  thinkingLevel?: string;
  mode?: string;
  metadata?: Record<string, unknown>;
  eventLog?: { collectionId: string; debugName: string };
};

type AgentConfigRow = {
  id: string;
  name: string;
  startCommand: string;
  availableModes: Array<{ value: string; name: string; description?: string }>;
};

function ModeCombobox({
  options,
  currentValue,
  onSelect,
}: {
  options: Array<{ value: string; name: string; description?: string }>;
  currentValue: string;
  onSelect: (value: string) => void;
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
          className="h-6 shrink-0 justify-between gap-1 px-2 font-normal text-xs text-neutral-400 hover:text-neutral-600 shadow-none"
          title="Mode"
        >
          <span className="truncate">{selected?.name ?? currentValue}</span>
          <ChevronDownIcon className="size-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="end">
        <Command>
          <CommandInput placeholder="Search modes…" className="h-9" />
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

function ComposerCwdInner({
  Original,
  agentId,
}: {
  Original: (props: { agentId: string }) => any;
  agentId: string;
}) {
  const rpc = useRpc();

  const agent = useDb((root) =>
    root.plugin.kernel.agents.find((a) => a.id === agentId),
  );
  const agentConfigs = useDb((root) => root.plugin.kernel.agentConfigs);
  const { items: events } = useCollection(agent?.eventLog);
  const hasUserMessages = useMemo(
    () => events.some((e) => e.data?.kind === "user_prompt"),
    [events],
  );
  const usage = useMemo(() => {
    if (!events) return null;
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i] ;
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

  const handlePickCwd = useCallback(async () => {
    const dir = await rpc.window.pickDirectory();
    if (!dir) return;
    try {
      await rpc.agent.changeCwd(agentId, dir);
    } catch (err) {
      console.error("[cwd-selector] changeCwd failed", err);
    }
  }, [rpc, agentId]);

  const handleModeChange = useCallback(
    async (value: string) => {
      await rpc.agent.setConfigOption(agentId, "mode", value);
    },
    [rpc, agentId],
  );

  const showCwd = !!agentCwd;
  const showMode = availableModes.length > 0;
  const showBar = showCwd || showMode || !!usage;

  const cwdDisplayName = agentCwd ? agentCwd.split("/").pop() || agentCwd : "";

  return (
    <div>
      {Original({ agentId })}
      {showBar && (
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
                <DropdownMenuItem className="text-xs" onClick={handlePickCwd}>
                  <FolderSyncIcon className="size-3" />
                  Change cwd
                </DropdownMenuItem>
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
                onSelect={handleModeChange}
              />
            )}
            {usage && <ContextIndicator used={usage.used} size={usage.size} />}
          </div>
        </div>
      )}
    </div>
  );
}

export function ComposerWrapper(
  Original: (props: { agentId: string }) => any,
  props: { agentId: string },
) {
  return <ComposerCwdInner Original={Original} agentId={props.agentId} />;
}
