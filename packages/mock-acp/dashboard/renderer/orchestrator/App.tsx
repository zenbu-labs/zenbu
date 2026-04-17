import { useMemo, useState, useCallback } from "react"
import { useWsConnection, RpcProvider, KyjuClientProvider } from "../lib/ws-connection"
import type { WsConnectionState } from "../lib/ws-connection"
import { KyjuProvider, useDb } from "../lib/kyju-react"
import { useKyjuClient } from "../lib/providers"
import { View } from "../lib/View"

const wsPort = Number(new URLSearchParams(window.location.search).get("wsPort"))

const viewSrcMap: Record<string, string> = {
  "control-panel": "/views/control-panel/index.html",
  "event-viewer": "/views/event-viewer/index.html",
  "agent-state": "/views/agent-state/index.html",
  "prompt-tester": "/views/prompt-tester/index.html",
}

type ViewItem = {
  id: string
  type: string
  title: string
  active: boolean
}

function TabBar() {
  const views = useDb((root) => root.views) as ViewItem[] | undefined
  const client = useKyjuClient()
  const viewList = useMemo(() => views ?? [], [views])
  const activeView = useMemo(
    () => viewList.find((v) => v.active) ?? viewList[0],
    [viewList],
  )

  const setActive = useCallback(
    async (id: string) => {
      const updated = viewList.map((v) => ({
        ...v,
        active: v.id === id,
      }))
      await (client as any).views.set(updated)
    },
    [client, viewList],
  )

  return (
    <div
      className="flex items-center gap-0.5 border-b border-neutral-300 bg-neutral-200 px-2"
      style={{ WebkitAppRegion: "drag" } as any}
    >
      <div className="w-16" />
      {viewList.map((view) => (
        <button
          key={view.id}
          onClick={() => setActive(view.id)}
          className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors cursor-default ${
            view.id === activeView?.id
              ? "bg-white text-neutral-900 border border-b-0 border-neutral-300"
              : "text-neutral-600 hover:text-neutral-800 hover:bg-neutral-300/50"
          }`}
          style={{ WebkitAppRegion: "no-drag" } as any}
        >
          {view.title}
        </button>
      ))}
    </div>
  )
}

function OrchestratorContent() {
  const views = useDb((root) => root.views) as ViewItem[] | undefined
  const viewList = useMemo(() => views ?? [], [views])
  const activeView = useMemo(
    () => viewList.find((v) => v.active) ?? viewList[0],
    [viewList],
  )

  return (
    <div className="flex h-full flex-col bg-neutral-100">
      <TabBar />
      <div className="relative flex-1 overflow-hidden">
        {activeView ? (
          viewList.map((view) => (
            <View
              key={view.id}
              id={view.id}
              src={`${viewSrcMap[view.type] ?? viewSrcMap["control-panel"]}?id=${view.id}`}
              serverPort={wsPort}
              hidden={view.id !== activeView.id}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
              }}
            />
          ))
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-400">
            <p>No views available</p>
          </div>
        )}
      </div>
    </div>
  )
}

function ConnectedApp({
  connection,
}: {
  connection: Extract<WsConnectionState, { status: "connected" }>
}) {
  return (
    <RpcProvider value={connection.rpc}>
      <KyjuClientProvider value={connection.kyjuClient}>
        <KyjuProvider
          client={connection.kyjuClient}
          replica={connection.replica}
        >
          <OrchestratorContent />
        </KyjuProvider>
      </KyjuClientProvider>
    </RpcProvider>
  )
}

export function App() {
  const connection = useWsConnection()

  if (connection.status === "connecting") {
    return (
      <div className="flex h-full items-center justify-center text-neutral-500">
        
      </div>
    )
  }

  if (connection.status === "error") {
    return (
      <div className="flex h-full items-center justify-center text-red-500">
        {connection.error}
      </div>
    )
  }

  return <ConnectedApp connection={connection} />
}
