import { useEffect, useRef, useMemo } from "react"
import { useDb, useCollection } from "../../../lib/kyju-react"
import { materializeMessages } from "../lib/materialize"
import { standardComponents } from "./modes/standard"
import { MessageList } from "./MessageList"

export function MinimapContent({ agentId }: { agentId: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const agent = useDb((root) =>
    root.plugin.kernel.agents.find((a) => a.id === agentId),
  )
  const streaming = agent?.status === "streaming"
  const { items: events } = useCollection(agent?.eventLog)
  const messages = useMemo(() => materializeMessages(events), [events])

  useEffect(() => {
    document.getElementById("root")?.setAttribute("data-minimap", "")
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const ro = new ResizeObserver(() => {
      window.parent.postMessage(
        { type: "zenbu-minimap-height", height: el.scrollHeight },
        "*",
      )
    })
    ro.observe(el)

    return () => ro.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="bg-(--zenbu-panel)">
      <MessageList
        messages={messages}
        loading={streaming}
        components={standardComponents}
      />
    </div>
  )
}
