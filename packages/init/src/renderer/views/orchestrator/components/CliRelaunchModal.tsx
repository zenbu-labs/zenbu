import { useCallback, useEffect, useState } from "react";
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

type Pending = {
  requestId: string;
  pluginName: string;
  reason: string;
};

/**
 * Modal driven by `events.cli.relaunchRequested`. A `zen setup` invocation
 * whose plugin is already loaded emits this event after the script finishes,
 * because dynohot can't hot-reload `node_modules`. The user's choice is
 * relayed back to the CLI via `cli.confirmRelaunch`.
 */
export function CliRelaunchModal() {
  const rpc = useRpc();
  const events = useEvents();

  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    const unsub = (events as any).cli.relaunchRequested.subscribe(
      (data: Pending) => {
        setPending(data);
      },
    );
    return () => unsub();
  }, [events]);

  const resolve = useCallback(
    async (decision: "accept" | "reject") => {
      if (!pending) return;
      const requestId = pending.requestId;
      setPending(null);
      try {
        await rpc.cli.confirmRelaunch(requestId, decision);
      } catch {}
    },
    [rpc, pending],
  );

  const open = pending != null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next: boolean) => {
        if (!next) resolve("reject");
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Relaunch Zenbu?</DialogTitle>
          <DialogDescription>
            {pending
              ? `${pending.pluginName}${pending.reason ? `: ${pending.reason}` : ""}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => resolve("reject")}
          >
            Later
          </Button>
          <Button
            size="sm"
            onClick={() => resolve("accept")}
            className="bg-blue-500 text-white hover:bg-blue-600"
          >
            Relaunch now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
