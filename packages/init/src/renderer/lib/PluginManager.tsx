import { useState, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog"
import { Button } from "../components/ui/button"
import { useRpc } from "./providers"

type PluginEntry = {
  manifestPath: string
  name: string
  enabled: boolean
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-4 w-7 flex-none items-center rounded-full transition-colors ${
        checked ? "bg-neutral-400" : "bg-neutral-300"
      }`}
    >
      <span
        className={`inline-block h-3 w-3 rounded-full bg-white transition-transform ${
          checked ? "translate-x-3.5" : "translate-x-0.5"
        }`}
      />
    </button>
  )
}

export function PluginManager({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const rpc = useRpc()
  const [plugins, setPlugins] = useState<PluginEntry[]>([])
  const [draft, setDraft] = useState<Map<string, boolean>>(new Map())
  const [saving, setSaving] = useState(false)

  const fetchPlugins = useCallback(async () => {
    const list: PluginEntry[] = await (rpc as any).installer.listPluginsWithStatus()
    setPlugins(list)
    setDraft(new Map())
  }, [rpc])

  useEffect(() => {
    if (open) fetchPlugins()
  }, [open, fetchPlugins])

  const toggleDraft = (manifestPath: string, currentEnabled: boolean) => {
    setDraft((prev) => {
      const next = new Map(prev)
      const original = plugins.find((p) => p.manifestPath === manifestPath)?.enabled ?? false
      const newValue = !currentEnabled
      if (newValue === original) {
        next.delete(manifestPath)
      } else {
        next.set(manifestPath, newValue)
      }
      return next
    })
  }

  const hasChanges = draft.size > 0

  const handleSave = async () => {
    setSaving(true)
    for (const [manifestPath, enabled] of draft) {
      await (rpc as any).installer.togglePlugin(manifestPath, enabled)
    }
    await fetchPlugins()
    setSaving(false)
  }

  const handleClose = async () => {
    if (draft.size > 0) {
      setSaving(true)
      for (const [manifestPath, enabled] of draft) {
        await (rpc as any).installer.togglePlugin(manifestPath, enabled)
      }
      setDraft(new Map())
      setSaving(false)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v) }}>
      <DialogContent className="sm:max-w-sm p-0 bg-white border-neutral-300 gap-0">
        <DialogHeader className="px-3 pt-3 pb-2">
          <DialogTitle className="text-xs font-medium text-neutral-400">Plugins</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col max-h-[60vh] overflow-y-auto">
          {plugins.map((plugin, i) => {
            const isEnabled = draft.has(plugin.manifestPath)
              ? draft.get(plugin.manifestPath)!
              : plugin.enabled
            const isChanged = draft.has(plugin.manifestPath)
            return (
              <div
                key={plugin.manifestPath}
                className={`flex items-center gap-3 px-3 py-2 ${
                  i > 0 ? "border-t border-neutral-300/50" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className={`text-[12px] font-medium truncate ${isChanged ? "text-neutral-900" : "text-neutral-700"}`}>
                    {plugin.name}
                  </div>
                  <div className="text-[10px] text-neutral-400 truncate">
                    {plugin.manifestPath.replace(/^\/Users\/[^/]+\//, "~/")}
                  </div>
                </div>
                <Toggle
                  checked={isEnabled}
                  onChange={() => toggleDraft(plugin.manifestPath, isEnabled)}
                />
              </div>
            )
          })}
          {plugins.length === 0 && (
            <div className="text-neutral-400 text-xs text-center py-4">
              No plugins found
            </div>
          )}
        </div>
        {hasChanges && (
          <DialogFooter className="px-3 py-2 border-t border-neutral-300/50">
            <div className="flex gap-2 w-full justify-end">
              <Button variant="ghost" size="sm" onClick={() => setDraft(new Map())} className="text-xs h-7 text-neutral-400">
                Discard
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="text-xs h-7">
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
