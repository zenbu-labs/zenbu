import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcwIcon, SearchIcon, XIcon } from "lucide-react";
import { useDb } from "../../../lib/kyju-react";
import { useRpc } from "../../../lib/providers";
import {
  comboFromEvent,
  formatBindingForDisplay,
} from "../../../lib/shortcut-keys";
import { useShortcutCaptureLock } from "../providers/shortcut-forwarder";

type ShortcutEntry = {
  id: string;
  defaultBinding: string;
  description: string;
  scope: string;
};

export function KeybindingsSection() {
  const rpc = useRpc();

  const registry = useDb((root) => root.plugin.kernel.shortcutRegistry) ?? [];
  const overrides = useDb((root) => root.plugin.kernel.shortcutOverrides) ?? {};
  const disabled = useDb((root) => root.plugin.kernel.shortcutDisabled) ?? [];
  const disabledSet = useMemo(() => new Set(disabled), [disabled]);

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filter = (r: ShortcutEntry) => {
      if (!q) return true;
      return (
        r.id.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        (overrides[r.id] ?? r.defaultBinding).toLowerCase().includes(q)
      );
    };
    return [...registry].filter(filter).sort((a, b) =>
      a.scope === b.scope
        ? a.id.localeCompare(b.id)
        : a.scope.localeCompare(b.scope),
    );
  }, [registry, overrides, query]);

  const registryIds = useMemo(() => new Set(registry.map((r) => r.id)), [
    registry,
  ]);
  const orphanedOverrides = useMemo(
    () => Object.keys(overrides).filter((id) => !registryIds.has(id)),
    [overrides, registryIds],
  );

  // Precompute a map of effective binding → ids for conflict detection.
  const bindingConflicts = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of registry) {
      if (disabledSet.has(r.id)) continue;
      const eff = overrides[r.id] ?? r.defaultBinding;
      const list = map.get(eff) ?? [];
      list.push(r.id);
      map.set(eff, list);
    }
    return map;
  }, [registry, overrides, disabledSet]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 pb-2">
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by id, description, or binding"
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded border border-border bg-background outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {rows.length === 0 && registry.length === 0 && (
          <div className="text-xs text-muted-foreground p-4 text-center">
            No shortcuts registered yet.
          </div>
        )}
        {rows.length === 0 && registry.length > 0 && (
          <div className="text-xs text-muted-foreground p-4 text-center">
            No shortcuts match &quot;{query}&quot;.
          </div>
        )}
        <div className="text-xs">
          <div className="flex items-center gap-3 px-1 py-1.5 text-muted-foreground border-b border-border">
            <div className="flex-1 min-w-0">Command</div>
            <div className="w-24 shrink-0">Scope</div>
            <div className="w-32 shrink-0">Binding</div>
            <div className="w-28 shrink-0 text-right">Actions</div>
          </div>
          {rows.map((r) => {
            const override = overrides[r.id];
            const effective = override ?? r.defaultBinding;
            const isOverridden = override !== undefined;
            const isDisabled = disabledSet.has(r.id);
            const conflicts = bindingConflicts.get(effective) ?? [];
            const hasConflict = conflicts.length > 1;
            return (
              <div
                key={r.id}
                className="flex items-center gap-3 px-1 py-1.5 border-b border-border/60 hover:bg-muted/40"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-mono truncate">{r.id}</div>
                  <div className="text-muted-foreground mt-0.5 truncate">
                    {r.description}
                  </div>
                </div>
                <div className="w-24 shrink-0 font-mono text-muted-foreground truncate">
                  {r.scope}
                </div>
                <div className="w-32 shrink-0">
                  <button
                    onClick={() => setEditing(r.id)}
                    className={
                      "font-mono text-[11px] px-1.5 py-0.5 rounded border " +
                      (isDisabled
                        ? "border-border/50 text-muted-foreground line-through"
                        : isOverridden
                          ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-600/60 dark:bg-amber-950/40 dark:text-amber-200"
                          : "border-border bg-muted hover:bg-muted/70")
                    }
                    title={
                      isOverridden
                        ? `Overridden (default: ${formatBindingForDisplay(r.defaultBinding)})`
                        : "Click to rebind"
                    }
                  >
                    {formatBindingForDisplay(effective)}
                  </button>
                  {hasConflict && !isDisabled && (
                    <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                      conflicts with{" "}
                      {conflicts.filter((x) => x !== r.id).join(", ")}
                    </div>
                  )}
                </div>
                <div className="w-28 shrink-0 flex items-center justify-end gap-1 whitespace-nowrap">
                  {isOverridden && (
                    <button
                      onClick={() =>
                        (rpc as any).shortcut.setBinding(r.id, null)
                      }
                      className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded hover:bg-muted"
                      title="Reset to default"
                    >
                      <RotateCcwIcon className="h-3 w-3" />
                      Reset
                    </button>
                  )}
                  {isDisabled ? (
                    <button
                      onClick={() => (rpc as any).shortcut.enable(r.id)}
                      className="text-[11px] px-1.5 py-0.5 rounded hover:bg-muted"
                    >
                      Enable
                    </button>
                  ) : (
                    <button
                      onClick={() => (rpc as any).shortcut.disable(r.id)}
                      className="text-[11px] px-1.5 py-0.5 rounded hover:bg-muted text-muted-foreground"
                    >
                      Disable
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {orphanedOverrides.length > 0 && (
          <div className="mt-6">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
              Unused overrides
            </div>
            <div className="text-[11px] text-muted-foreground mb-2">
              These shortcut ids are not currently registered by any loaded
              plugin. Their overrides are kept in case the plugin is
              reinstalled.
            </div>
            <ul className="space-y-1">
              {orphanedOverrides.map((id) => (
                <li
                  key={id}
                  className="flex items-center justify-between text-xs px-2 py-1 rounded bg-muted/50"
                >
                  <span className="font-mono">{id}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[11px]">
                      {formatBindingForDisplay(overrides[id]!)}
                    </span>
                    <button
                      onClick={() =>
                        (rpc as any).shortcut.setBinding(id, null)
                      }
                      className="text-muted-foreground hover:text-foreground"
                      title="Remove override"
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {editing &&
        (() => {
          const row = registry.find((r) => r.id === editing);
          if (!row) return null;
          const current = overrides[row.id] ?? row.defaultBinding;
          return (
            <ChordCaptureDialog
              open
              shortcutId={row.id}
              description={row.description}
              currentBinding={current}
              onCommit={async (binding) => {
                setEditing(null);
                await (rpc as any).shortcut.setBinding(row.id, binding);
              }}
              onClose={() => setEditing(null)}
            />
          );
        })()}
    </div>
  );
}

function ChordCaptureDialog({
  open,
  shortcutId,
  description,
  currentBinding,
  onCommit,
  onClose,
}: {
  open: boolean;
  shortcutId: string;
  description: string;
  currentBinding: string;
  onCommit: (binding: string) => void;
  onClose: () => void;
}) {
  const [chord, setChord] = useState<string[]>([]);

  useShortcutCaptureLock(open);

  useEffect(() => {
    if (!open) setChord([]);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
        return;
      }
      if (e.key === "Enter" && chord.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onCommit(chord.join(" "));
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setChord((prev) => prev.slice(0, -1));
        return;
      }
      const combo = comboFromEvent(e);
      if (!combo) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      setChord((prev) => [...prev, combo]);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, chord, onCommit, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      onMouseDown={onClose}
    >
      <div
        className="w-[440px] rounded-md bg-background border border-border shadow-xl p-4"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-1 text-sm font-medium">Edit binding</div>
        <div className="mb-3 text-xs text-muted-foreground">
          <span className="font-mono">{shortcutId}</span>
          {description ? ` · ${description}` : ""}
        </div>

        <div className="flex items-center justify-center py-6 rounded bg-muted/40 border border-dashed border-border">
          {chord.length === 0 ? (
            <span className="text-xs text-muted-foreground">
              Press a key combination…
            </span>
          ) : (
            <span className="font-mono text-base px-2 py-1 rounded bg-background border border-border">
              {formatBindingForDisplay(chord.join(" "))}
            </span>
          )}
        </div>

        <div className="mt-2 text-[11px] text-muted-foreground">
          Current:{" "}
          <span className="font-mono">
            {formatBindingForDisplay(currentBinding) || "(none)"}
          </span>
          {" · "}Press multiple combos for a chord (e.g. ⌘K ⌘S).
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setChord([])}
              className="text-xs px-2 py-1 rounded border border-border hover:bg-muted disabled:opacity-50"
              disabled={chord.length === 0}
            >
              Clear
            </button>
            <span className="text-[10px] text-muted-foreground">
              Backspace removes last key
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-xs px-2 py-1 rounded border border-border hover:bg-muted"
            >
              Cancel <span className="text-muted-foreground">(Esc)</span>
            </button>
            <button
              onClick={() => onCommit(chord.join(" "))}
              disabled={chord.length === 0}
              className="text-xs px-2 py-1 rounded bg-foreground text-background hover:opacity-90 disabled:opacity-40"
            >
              Save <span className="opacity-70">(Enter)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
