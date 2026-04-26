import { useCallback, useState } from "react";
import { DownloadIcon, XIcon, RotateCwIcon } from "lucide-react";
import { useDb } from "../../../lib/kyju-react";
import { useRpc } from "../../../lib/providers";

/**
 * Slim status bar shown above the orchestrator pane area when the
 * kernel binary has an update in flight. State lives at
 * `root.plugin.kernel.updateState` and is written by the main-process
 * `KernelUpdaterService` (see `services/kernel-updater.ts`).
 *
 * Rendered states:
 *   - available   → "Update available. Download / Dismiss"
 *   - downloading → progress bar with percent
 *   - downloaded  → "Restart to install"
 *   - error       → error message + Retry
 *   - idle/checking/not-available → hidden
 *
 * The git-source update modal (`PluginUpdateModal`) is a separate flow
 * for kernel source / plugin pulls; do not conflate them.
 */
export function KernelBinaryUpdateBanner() {
  const state = useDb((root) => root.plugin.kernel.updateState);
  const rpc = useRpc();
  const [busy, setBusy] = useState<null | "download" | "install" | "check">(
    null,
  );

  const download = useCallback(async () => {
    setBusy("download");
    try {
      await rpc.kernelUpdater.downloadUpdate();
    } catch (err) {
      console.error("[kernel-update-banner] download failed:", err);
    } finally {
      setBusy(null);
    }
  }, [rpc]);

  const install = useCallback(async () => {
    setBusy("install");
    try {
      await rpc.kernelUpdater.quitAndInstall();
    } catch {
      // Transport may die as the app quits; swallow.
    } finally {
      setBusy(null);
    }
  }, [rpc]);

  const dismiss = useCallback(async () => {
    try {
      await rpc.kernelUpdater.dismissAvailable();
    } catch (err) {
      console.error("[kernel-update-banner] dismiss failed:", err);
    }
  }, [rpc]);

  const retry = useCallback(async () => {
    setBusy("check");
    try {
      await rpc.kernelUpdater.checkForUpdates();
    } catch (err) {
      console.error("[kernel-update-banner] retry failed:", err);
    } finally {
      setBusy(null);
    }
  }, [rpc]);

  if (!state) return null;

  const {
    status,
    availableVersion,
    dismissedVersion,
    downloadPercent,
    error,
  } = state;

  if (status === "idle" || status === "checking" || status === "not-available") {
    return null;
  }

  if (
    status === "available" &&
    availableVersion &&
    dismissedVersion === availableVersion
  ) {
    return null;
  }

  if (status === "available") {
    return (
      <Bar tone="info">
        <span className="flex-1 truncate">
          Update available{availableVersion ? ` (${availableVersion})` : ""}.
        </span>
        <BarButton onClick={download} disabled={busy !== null}>
          <DownloadIcon className="size-3" />
          {busy === "download" ? "Starting…" : "Download"}
        </BarButton>
        <BarIconButton title="Dismiss" onClick={dismiss}>
          <XIcon className="size-3" />
        </BarIconButton>
      </Bar>
    );
  }

  if (status === "downloading") {
    const pct = typeof downloadPercent === "number" ? downloadPercent : 0;
    return (
      <Bar tone="info">
        <div className="relative flex-1 h-1.5 rounded-full bg-blue-100 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-blue-500 transition-[width] duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="shrink-0 tabular-nums text-[11px]">
          Downloading… {Math.floor(pct)}%
        </span>
      </Bar>
    );
  }

  if (status === "downloaded") {
    return (
      <Bar tone="success">
        <span className="flex-1 truncate">
          Update ready. Restart Zenbu to install
          {availableVersion ? ` ${availableVersion}` : ""}.
        </span>
        <BarButton onClick={install} disabled={busy !== null}>
          {busy === "install" ? "Restarting…" : "Restart"}
        </BarButton>
      </Bar>
    );
  }

  if (status === "error") {
    return (
      <Bar tone="error">
        <span className="flex-1 truncate">
          Couldn't check for updates{error ? `: ${error}` : ""}.
        </span>
        <BarButton onClick={retry} disabled={busy !== null}>
          <RotateCwIcon className="size-3" />
          {busy === "check" ? "Retrying…" : "Retry"}
        </BarButton>
      </Bar>
    );
  }

  return null;
}

function Bar({
  tone,
  children,
}: {
  tone: "info" | "success" | "error";
  children: React.ReactNode;
}) {
  const bg =
    tone === "info"
      ? "bg-blue-50 text-blue-900 border-blue-200"
      : tone === "success"
      ? "bg-emerald-50 text-emerald-900 border-emerald-200"
      : "bg-red-50 text-red-900 border-red-200";
  return (
    <div
      className={`flex h-7 shrink-0 items-center gap-2 border-b px-3 text-[11px] ${bg}`}
    >
      {children}
    </div>
  );
}

function BarButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded px-2 py-0.5 bg-white/60 hover:bg-white disabled:opacity-60 text-[11px] font-medium"
    >
      {children}
    </button>
  );
}

function BarIconButton({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex items-center justify-center rounded p-0.5 hover:bg-white/70"
    >
      {children}
    </button>
  );
}
