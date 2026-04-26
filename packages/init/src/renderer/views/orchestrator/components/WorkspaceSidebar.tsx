import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDb } from "../../../lib/kyju-react";
import { useKyjuClient, useRpc } from "../../../lib/providers";

const RAIL_WIDTH = 48;

type WorkspaceEntry = {
  id: string;
  name: string;
  cwds: string[];
  createdAt: number;
  icon: {
    blobId: string;
    origin: "override" | "scanned";
    sourcePath: string | null;
  } | null;
};

export function WorkspaceSidebar({
  windowId,
  activeWorkspaceId,
  onSelectWorkspace,
}: {
  windowId: string;
  activeWorkspaceId: string | null;
  onSelectWorkspace: (workspaceId: string) => void;
}) {
  const rpc = useRpc();
  const client = useKyjuClient();
  const workspaces = useDb((root) => root.plugin.kernel.workspaces) as
    | WorkspaceEntry[]
    | undefined;

  const sorted = useMemo(
    () =>
      [...(workspaces ?? [])].sort(
        (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0),
      ),
    [workspaces],
  );

  const handleCreateWorkspace = useCallback(async () => {
    try {
      const dir: string | null = await rpc.window.pickDirectory();
      if (!dir) return;
      const name = dir.split("/").pop() || dir;
      const result = await rpc.workspace.createWorkspace(name, [dir]);
      onSelectWorkspace(result.id);
    } catch (e) {
      console.error("[workspace-sidebar] create failed:", e);
    }
  }, [rpc, onSelectWorkspace]);

  return (
    <div
      className="shrink-0 flex flex-col items-center gap-1 py-2 overflow-y-auto"
      style={
        {
          width: RAIL_WIDTH,
          background: "var(--zenbu-chrome)",
          WebkitAppRegion: "no-drag",
        } as any
      }
    >
      {sorted.map((ws) => (
        <WorkspaceRailItem
          key={ws.id}
          workspace={ws}
          isActive={ws.id === activeWorkspaceId}
          onSelect={() => onSelectWorkspace(ws.id)}
          onUploadIcon={async (file) => {
            const data = new Uint8Array(await file.arrayBuffer());
            const blobId = await (client as any).createBlob(data, true);
            await rpc.workspace.setWorkspaceIcon(ws.id, blobId, "override");
          }}
        />
      ))}
      <button
        type="button"
        onClick={handleCreateWorkspace}
        title="New workspace"
        className="flex items-center justify-center mt-1 text-(--zenbu-agent-sidebar-muted) hover:text-(--zenbu-agent-sidebar-foreground) hover:bg-(--zenbu-agent-sidebar-hover)"
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          border: "1px dashed var(--zenbu-panel-border)",
          cursor: "pointer",
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}

function WorkspaceRailItem({
  workspace,
  isActive,
  onSelect,
  onUploadIcon,
}: {
  workspace: WorkspaceEntry;
  isActive: boolean;
  onSelect: () => void;
  onUploadIcon: (file: File) => Promise<void>;
}) {
  const rpc = useRpc();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const label = workspace.name || workspace.cwds[0]?.split("/").pop() || "?";
  const fallback = (label[0] ?? "?").toUpperCase();

  const onContextMenu = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      const result = await rpc.window.showContextMenu([
        { id: "change-icon", label: "Change Icon..." },
        { id: "rescan-icon", label: "Re-scan Icon from Project" },
      ]);
      if (result === "change-icon") {
        fileInputRef.current?.click();
      } else if (result === "rescan-icon") {
        try {
          await rpc.workspace.ensureWorkspaceIcon(workspace.id);
        } catch (err) {
          console.error("[workspace-sidebar] rescan icon failed:", err);
        }
      }
    },
    [rpc, workspace.id],
  );

  return (
    <>
      <button
        type="button"
        onClick={onSelect}
        onContextMenu={onContextMenu}
        title={workspace.name}
        className="relative flex items-center justify-center"
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: isActive
            ? "var(--zenbu-agent-sidebar-active)"
            : "transparent",
          boxShadow: isActive ? "0 0 0 1px var(--zenbu-panel-border)" : "none",
          cursor: "pointer",
        }}
      >
        <span
          aria-hidden
          className="absolute"
          style={{
            left: -6,
            top: 6,
            bottom: 6,
            width: 3,
            borderRadius: 2,
            background: isActive
              ? "var(--zenbu-agent-sidebar-foreground)"
              : "transparent",
          }}
        />
        <WorkspaceIcon
          blobId={workspace.icon?.blobId}
          fallback={fallback}
          isActive={isActive}
        />
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/svg+xml,image/png,image/jpeg,image/gif,image/webp,image/x-icon"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          onUploadIcon(file).catch((err) =>
            console.error("[workspace-sidebar] icon upload failed:", err),
          );
        }}
      />
    </>
  );
}

function WorkspaceIcon({
  blobId,
  fallback,
  isActive,
}: {
  blobId: string | undefined;
  fallback: string;
  isActive: boolean;
}) {
  const client = useKyjuClient() as any;
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blobId) {
      setUrl(null);
      return;
    }
    let revoke: string | null = null;
    (async () => {
      try {
        const data: Uint8Array | null = await client.getBlobData(blobId);
        if (!data) return;
        const mime = sniffImageMime(data);
        const blob = new Blob([data as BlobPart], { type: mime });
        revoke = URL.createObjectURL(blob);
        setUrl(revoke);
      } catch {}
    })();
    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
      setUrl(null);
    };
  }, [client, blobId]);

  const size = 22;
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className="object-contain"
        style={{
          width: size,
          height: size,
          borderRadius: 4,
        }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex items-center justify-center text-[12px] font-medium"
      style={{
        width: size,
        height: size,
        borderRadius: 4,
        background: isActive
          ? "var(--zenbu-agent-sidebar-hover)"
          : "color-mix(in srgb, var(--zenbu-agent-sidebar-hover) 70%, transparent)",
        color: "var(--zenbu-agent-sidebar-foreground)",
      }}
    >
      {fallback}
    </span>
  );
}

function sniffImageMime(data: Uint8Array): string {
  // PNG: 89 50 4E 47
  if (
    data.length >= 4 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47
  )
    return "image/png";
  // JPEG: FF D8 FF
  if (
    data.length >= 3 &&
    data[0] === 0xff &&
    data[1] === 0xd8 &&
    data[2] === 0xff
  )
    return "image/jpeg";
  // GIF: 47 49 46
  if (
    data.length >= 3 &&
    data[0] === 0x47 &&
    data[1] === 0x49 &&
    data[2] === 0x46
  )
    return "image/gif";
  // WebP: RIFF....WEBP
  if (
    data.length >= 12 &&
    data[0] === 0x52 &&
    data[1] === 0x49 &&
    data[2] === 0x46 &&
    data[3] === 0x46 &&
    data[8] === 0x57 &&
    data[9] === 0x45 &&
    data[10] === 0x42 &&
    data[11] === 0x50
  )
    return "image/webp";
  // ICO: 00 00 01 00
  if (
    data.length >= 4 &&
    data[0] === 0x00 &&
    data[1] === 0x00 &&
    data[2] === 0x01 &&
    data[3] === 0x00
  )
    return "image/x-icon";
  return "image/svg+xml";
}
