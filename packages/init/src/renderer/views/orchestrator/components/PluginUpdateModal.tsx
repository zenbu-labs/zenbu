import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEvents, useRpc } from "@/lib/providers";

/**
 * A staged update returned by `gitUpdates.pullAndInstall` when a
 * `setup.version` bump was detected. setup.ts has NOT run yet — nothing
 * has been installed. The user must explicitly Install & Relaunch
 * (`commitPluginUpdate`) or discard (`rollbackPluginUpdate`).
 */
export type PendingUpdate = {
  plugin: string;
  version: number;
};

type CommitResult =
  | { ok: true }
  | { ok: false; error: string; stage: "setup" | "state" | "pending" };

/**
 * Single source of truth for the post-pull install confirmation modal.
 *
 * Wraps the install/cancel/progress flow that's identical for both the
 * kernel update path (orchestrator menu and Settings → Updates) and the
 * per-plugin update path (Settings → Plugins). Backend RPC contract is
 * the same for all plugins (`commitPluginUpdate` / `rollbackPluginUpdate`)
 * so this component is plugin-agnostic — callers just hand it a
 * `PendingUpdate` and a callback for when it's resolved.
 *
 * `descriptionPending` lets callers tweak the user-facing copy. The
 * kernel from the menu wants a friendlier "this update needs a restart"
 * vibe; the Plugins tab can stay verbose ("X has a new setup version
 * that needs to install dependencies before use…"). Title and Installing
 * copy are shared.
 */
export function PluginUpdateModal({
  pending,
  onResolved,
  descriptionPending,
}: {
  pending: PendingUpdate | null;
  onResolved: () => void;
  descriptionPending?: string;
}) {
  const rpc = useRpc();
  const events = useEvents();

  const [installing, setInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState<string[]>([]);
  const [installError, setInstallError] = useState<CommitResult | null>(null);

  const installingRef = useRef(installing);
  installingRef.current = installing;

  const pluginName = pending?.plugin;

  useEffect(() => {
    if (!pluginName) return;
    const unsub = events.setup.progress.subscribe(
      (data: { pluginName: string; line: string }) => {
        if (!installingRef.current) return;
        if (data.pluginName !== pluginName) return;
        setInstallProgress((lines) => {
          const next = [...lines, data.line];
          return next.length > 200 ? next.slice(next.length - 200) : next;
        });
      },
    );
    return () => unsub();
  }, [events, pluginName]);

  // Reset *in-flight* state whenever a new pending update arrives.
  // NOTE: deliberately do NOT reset `installError` here. When a commit
  // fails we call `setInstallError(r)` followed by `onResolved()`, which
  // flips parent-side `pending` to null. If we cleared `installError` on
  // that pending change too, both updates would land in the same React
  // batch and the toast would never paint — the user would see the modal
  // disappear with no error. The error stays visible until either:
  //   • the user clicks the toast's dismiss button, or
  //   • the next install attempt clears it via `setInstallError(null)`
  //     in `installAndRelaunch`.
  useEffect(() => {
    setInstalling(false);
    setInstallProgress([]);
  }, [pending?.plugin, pending?.version]);

  const installAndRelaunch = useCallback(async () => {
    if (!pending) return;
    setInstalling(true);
    setInstallError(null);
    setInstallProgress([]);
    try {
      const r: CommitResult = await rpc.gitUpdates.commitPluginUpdate({
        plugin: pending.plugin,
        version: pending.version,
      });
      if (!r.ok) {
        setInstallError(r);
        // Backend auto-rolled back on failure; close the dialog.
        onResolved();
      }
      // If r.ok: transport dies from app.relaunch; nothing to do here.
    } catch {
      // Transport died mid-response — that's the relaunch happening.
    } finally {
      setInstalling(false);
    }
  }, [rpc, pending, onResolved]);

  const dismiss = useCallback(async () => {
    if (!pending) return;
    try {
      await rpc.gitUpdates.rollbackPluginUpdate({
        plugin: pending.plugin,
      });
    } catch (err) {
      console.error("[PluginUpdateModal] rollback failed:", err);
    }
    onResolved();
  }, [rpc, pending, onResolved]);

  const open = pending != null;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next: boolean) => {
          if (!next && !installing) dismiss();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {installing
                ? `Installing ${pending?.plugin}…`
                : "Update available"}
            </DialogTitle>
            <DialogDescription>
              {installing
                ? "Running setup. Zenbu will relaunch automatically when installation completes."
                : (descriptionPending ??
                  `${pending?.plugin ?? "This plugin"} has a new setup version that needs to install dependencies before use. Zenbu will relaunch once installation completes.`)}
            </DialogDescription>
          </DialogHeader>

          {(installing || installProgress.length > 0) && (
            <pre className="max-h-48 overflow-auto rounded-md border border-border bg-muted/40 p-2 text-[11px] font-mono whitespace-pre-wrap break-words">
              {installProgress.length > 0
                ? installProgress.join("\n")
                : "Starting…"}
            </pre>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={dismiss}
              disabled={installing}
            >
              Later
            </Button>
            <Button
              size="sm"
              onClick={installAndRelaunch}
              disabled={installing}
              className="bg-blue-500 text-white hover:bg-blue-600"
            >
              {installing ? "Installing…" : "Install & Relaunch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {installError && !installError.ok && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-md border border-destructive/40 bg-destructive/95 px-3 py-2 text-xs text-destructive-foreground shadow-md">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <p className="font-medium">
                Install failed ({installError.stage})
              </p>
              <p className="whitespace-pre-wrap break-words">
                {installError.error}
              </p>
              <p className="mt-1 opacity-80">
                Update was rolled back. Pull again to retry.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setInstallError(null)}
              className="-mr-1 -mt-1 rounded px-1 leading-none opacity-70 hover:opacity-100"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  );
}
