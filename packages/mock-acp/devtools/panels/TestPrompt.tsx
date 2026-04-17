import { useState, useCallback } from "react"
import { useSendPrompt, useRpc } from "../lib/use-control-connection"

const PRESETS = [
  { label: "Hello", text: "Hello, how are you?" },
  { label: "Code Review", text: "Can you review this code for me?" },
  { label: "Long Response", text: "Give me a long detailed explanation" },
]

export function TestPromptPanel() {
  const sendPrompt = useSendPrompt()
  const rpc = useRpc()
  const [custom, setCustom] = useState("")
  const [sending, setSending] = useState(false)

  const send = useCallback(
    async (text: string) => {
      setSending(true)
      try {
        await sendPrompt(text)
      } finally {
        setSending(false)
      }
    },
    [sendPrompt],
  )

  const cancel = useCallback(async () => {
    await rpc.cancel()
  }, [rpc])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-700">Test Prompt</h3>
        {sending && (
          <button
            onClick={cancel}
            className="px-2 py-0.5 text-xs rounded bg-red-100 text-red-600 hover:bg-red-200"
          >
            Cancel
          </button>
        )}
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => send(p.text)}
            disabled={sending}
            className="px-2.5 py-1 text-xs rounded border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Custom prompt..."
          className="flex-1 h-7 rounded border border-neutral-200 bg-white px-2 text-xs outline-none focus:border-neutral-300"
          onKeyDown={(e) => {
            if (e.key === "Enter" && custom.trim()) {
              send(custom.trim())
              setCustom("")
            }
          }}
        />
        <button
          onClick={() => {
            if (custom.trim()) {
              send(custom.trim())
              setCustom("")
            }
          }}
          disabled={sending || !custom.trim()}
          className="px-3 h-7 text-xs rounded bg-neutral-800 text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  )
}
