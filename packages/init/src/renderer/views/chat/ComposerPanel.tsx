import { Composer } from "./components/Composer"

export type ComposerPanelProps = {
  agentId: string
  scrollToBottom?: () => void
}

export function ComposerPanel({ agentId, scrollToBottom }: ComposerPanelProps) {
  return (
    <div className="shrink-0">
      <Composer agentId={agentId} scrollToBottom={scrollToBottom} />
    </div>
  )
}
