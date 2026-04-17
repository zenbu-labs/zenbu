import { code } from "@streamdown/code"
import { CodeBlock } from "streamdown"
import type { ComponentProps, ReactNode } from "react"
import { isValidElement, useState } from "react"
import { CheckIcon, ExternalLinkIcon, CopyIcon } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog"
import { Button } from "../../../components/ui/button"
import { useRpc } from "../../../lib/providers"

function extractText(node: ReactNode): string {
  if (node == null || node === false) return ""
  if (typeof node === "string") return node
  if (typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(extractText).join("")
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode }
    return extractText(props.children)
  }
  return ""
}

function CopyButton({ code: codeText }: { code: string }) {
  const rpc = useRpc()
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    void (rpc as any).window.copyToClipboard(codeText)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
    >
      {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
    </button>
  )
}

function CodeComponent(props: ComponentProps<"code"> & { "data-block"?: string }) {
  if (!("data-block" in props)) {
    return (
      <code
        {...props}
        className={"rounded bg-muted px-1 py-0.5 font-mono " + (props.className ?? "")}
      />
    )
  }
  const languageMatch = /language-([^\s]+)/.exec(props.className ?? "")
  const language = languageMatch?.[1] ?? "text"
  const raw = extractText(props.children).replace(/\n$/, "")
  return (
    <CodeBlock code={raw} language={language}>
      <CopyButton code={raw} />
    </CodeBlock>
  )
}

function LinkSafetyModal({
  url,
  isOpen,
  onClose,
}: {
  url: string
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const rpc = useRpc()
  const handleOpen = () => {
    rpc.window.openExternal(url)
    onClose()
  }
  const handleCopy = () => {
    void (rpc as any).window.copyToClipboard(url)
  }
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ExternalLinkIcon className="size-5" />
            Open external link?
          </DialogTitle>
          <DialogDescription>
            You're about to visit an external website.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md bg-muted px-3 py-2 font-mono text-sm break-all">
          {url}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCopy}>
            <CopyIcon />
            Copy link
          </Button>
          <Button onClick={handleOpen}>
            <ExternalLinkIcon />
            Open link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export const streamdownProps = {
  plugins: { code },
  controls: {
    code: false,
    table: false,
  },
  components: {
    code: CodeComponent,
  },
  linkSafety: {
    enabled: true,
    renderModal: (props: {
      url: string
      isOpen: boolean
      onClose: () => void
      onConfirm: () => void
    }) => <LinkSafetyModal {...props} />,
  },
}
