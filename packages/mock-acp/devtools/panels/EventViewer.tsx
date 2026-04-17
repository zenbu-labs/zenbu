import { useMemo, useState } from "react"
import { mockKyju } from "../App"

export function EventViewer() {
  const { items: events } = mockKyju.useCollection((c) => c.events)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)

  const sorted = useMemo(
    () => [...events].sort((a, b) => b.timestamp - a.timestamp),
    [events],
  )

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto border-r border-neutral-200">
        <div className="sticky top-0 bg-neutral-100 border-b border-neutral-200 px-3 py-2">
          <h3 className="text-xs font-semibold text-neutral-600">
            Events ({events.length})
          </h3>
        </div>
        {sorted.length === 0 ? (
          <div className="p-4 text-xs text-neutral-400 text-center">
            No events yet. Send a prompt to the mock agent to see events.
          </div>
        ) : (
          sorted.map((event, i) => (
            <button
              key={i}
              onClick={() => setSelectedIdx(i)}
              className={`w-full text-left px-3 py-2 border-b border-neutral-100 text-xs transition-colors ${
                selectedIdx === i ? "bg-blue-50" : "hover:bg-neutral-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    event.direction === "emitted" ? "bg-green-400" : "bg-blue-400"
                  }`}
                />
                <span className="font-mono text-neutral-500">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
                <span className="font-medium text-neutral-700">
                  {event.updateType}
                </span>
                <span className="text-neutral-400 ml-auto">{event.direction}</span>
              </div>
            </button>
          ))
        )}
      </div>
      <div className="w-80 overflow-y-auto p-3">
        {selectedIdx !== null && sorted[selectedIdx] ? (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-neutral-600">Event Detail</h4>
            <pre className="text-xs font-mono bg-neutral-50 p-2 rounded border border-neutral-200 overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(sorted[selectedIdx], null, 2)}
            </pre>
          </div>
        ) : (
          <div className="text-xs text-neutral-400 text-center mt-8">
            Select an event to view details
          </div>
        )}
      </div>
    </div>
  )
}
