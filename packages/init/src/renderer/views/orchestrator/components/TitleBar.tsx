import { useCallback, useState } from "react"
import { PuzzleIcon } from "lucide-react"
import { useDb } from "../../../lib/kyju-react"
import { useKyjuClient, useRpc } from "../../../lib/providers"
import { PluginManager } from "../../../lib/PluginManager"

export function TitleBar() {
  const workspaces = useDb((root) => root.plugin.kernel.workspaces)
  const activeWorkspaceId = useDb((root) => root.plugin.kernel.activeWorkspaceId)
  const rpc = useRpc()
  const [pluginsOpen, setPluginsOpen] = useState(false)

  const activeWorkspaceName = (workspaces ?? []).find(
    (w) => w.id === activeWorkspaceId,
  )?.name

  return (
    <>
      <div
        className="flex h-6 shrink-0 items-center bg-[#E0E0E0]"
        style={{ WebkitAppRegion: "drag" } as any}
      >
        <div className="shrink-0 pl-[74px]" />
        <div className="flex flex-1 items-center justify-center">
          {activeWorkspaceName && activeWorkspaceId && (
            <span
              className="text-[11px] font-semibold text-neutral-500"
              style={{ WebkitAppRegion: "no-drag" } as any}
              onContextMenu={async (e) => {
                e.preventDefault()
                const selection = await rpc.window.showContextMenu([
                  { id: "delete-workspace", label: "Delete Workspace" },
                ])
                if (selection === "delete-workspace") {
                  await rpc.window.removeWorkspace(activeWorkspaceId)
                }
              }}
            >
              {activeWorkspaceName}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-1 pr-2" style={{ WebkitAppRegion: "no-drag" } as any}>
          <button
            onClick={() => setPluginsOpen(true)}
            className="flex h-6 w-7 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-black/10 hover:text-neutral-700"
            title="Plugins"
          >
            <PuzzleIcon size={14} />
          </button>
        </div>
      </div>
      <PluginManager open={pluginsOpen} onOpenChange={setPluginsOpen} />
    </>
  )
}
