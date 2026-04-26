import { useCallback, useEffect, useState } from "react";
import {
  RpcProvider,
  EventsProvider,
  KyjuClientProvider,
  useRpc,
  useKyjuClient,
  useWsConnection,
} from "@/lib/ws-connection";
import { KyjuProvider, useDb } from "@/lib/kyju-react";
import type { WsConnectionState } from "@/lib/ws-connection";
import { Composer } from "@/views/chat/components/Composer";
import { FolderSyncIcon } from "lucide-react";

const urlParams = new URLSearchParams(window.location.search);
const windowId = urlParams.get("windowId") ?? "";
const sentinelTabId = urlParams.get("agentId") ?? "";

function NewAgentScreen() {
  const rpc = useRpc();
  const client = useKyjuClient();

  // Active workspace's first cwd is the default location for the new agent.
  // The user can override it via the cwd picker before submitting.
  const activeWorkspaceId = useDb(
    (root) => root.plugin.kernel.activeWorkspaceByWindow?.[windowId],
  );
  const workspaces = useDb((root) => root.plugin.kernel.workspaces);
  const activeWorkspace = (workspaces ?? []).find(
    (w) => w.id === activeWorkspaceId,
  );
  const workspaceCwd = activeWorkspace?.cwds?.[0];

  const [pendingCwd, setPendingCwd] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (pendingCwd === undefined && workspaceCwd) setPendingCwd(workspaceCwd);
  }, [workspaceCwd, pendingCwd]);

  const displayCwd = pendingCwd ?? workspaceCwd ?? "~";

  const onPickCwd = useCallback(async () => {
    const dir: string | null = await rpc.window.pickDirectory();
    if (!dir) return;
    setPendingCwd(dir);
  }, [rpc]);

  const onSubmit = useCallback(
    async (text: string, images: any[], editorStateJson: unknown) => {
      const cwd = pendingCwd ?? workspaceCwd;
      // Promote the sentinel tab to a real agent: kernel creates the agent +
      // session, swaps the pane's tab id from `new-agent:<id>` to the new
      // session id. Returns `{ agentId, sessionId }`.
      const { agentId } = await rpc["new-agent"].promoteNewAgentTab({
        windowId,
        sentinelTabId,
        cwd,
      });

      // Write the user_prompt to the agent's event log immediately so chat
      // displays the message without waiting for the agent's first ACP roundtrip.
      const agentNodeId = client.plugin.kernel.agents
        .read()
        .findIndex((a) => a.id === agentId);
      const node =
        agentNodeId !== -1 ? client.plugin.kernel.agents[agentNodeId] : null;

      const now = Date.now();
      const eventData: any = {
        kind: "user_prompt",
        text,
        editorState: editorStateJson,
      };
      // cons
      if (images.length > 0) {
        eventData.images = images.map((img: any) => ({
          blobId: img.blobId,
          mimeType: img.mimeType,
        }));
      }
      if (node) {
        await node.eventLog.concat([{ timestamp: now, data: eventData }]);
        await node.status.set("streaming");
        await node.lastUserMessageAt?.set(now);
      }

      await rpc.agent.send(
        agentId,
        text,
        images.length > 0 ? images : undefined,
        cwd ? { cwd } : undefined,
      );
    },
    [rpc, client, pendingCwd, workspaceCwd],
  );

  return (
    <div className="flex h-full w-full items-start justify-center px-6 pt-[14vh]">
      <div className="w-full max-w-[919px] flex flex-col">
        <div className="mx-auto w-full max-w-[919px] px-4 mb-1">
          <button
            type="button"
            onClick={onPickCwd}
            className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[12px] text-neutral-600 hover:bg-black/5 hover:text-neutral-900 transition-colors"
            title={displayCwd}
          >
            <span className="truncate max-w-[360px]">
              {displayCwd.split("/").pop() || displayCwd}
            </span>
            <FolderSyncIcon className="size-3 opacity-70" />
          </button>
        </div>
        <Composer agentId={sentinelTabId} onSubmit={onSubmit} />
      </div>
    </div>
  );
}

function ConnectedApp({
  connection,
}: {
  connection: Extract<WsConnectionState, { status: "connected" }>;
}) {
  return (
    <RpcProvider value={connection.rpc}>
      <EventsProvider value={connection.events}>
        <KyjuClientProvider value={connection.kyjuClient}>
          <KyjuProvider
            client={connection.kyjuClient}
            replica={connection.replica}
          >
            <NewAgentScreen />
          </KyjuProvider>
        </KyjuClientProvider>
      </EventsProvider>
    </RpcProvider>
  );
}

export function App() {
  const connection = useWsConnection();
  if (connection.status === "connecting") {
    return <div className="h-full" />;
  }
  if (connection.status === "error") {
    return (
      <div className="flex h-full items-center justify-center text-red-500 text-xs">
        {connection.error}
      </div>
    );
  }
  return <ConnectedApp connection={connection} />;
}
