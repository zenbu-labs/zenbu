import { code } from "@streamdown/code"
import { CodeBlockCopyButton } from "streamdown"
import type { ComponentProps } from "react"

function Pre(props: ComponentProps<"pre">) {
  return (
    <div className="group/code relative">
      <pre {...props} />
      <CodeBlockCopyButton className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 transition-opacity cursor-pointer rounded-md p-1 text-muted-foreground hover:text-foreground bg-background/80 backdrop-blur-sm border border-border" />
    </div>
  )
}

export const streamdownProps = {
  plugins: { code },
  controls: {
    code: false,
    table: false,
  },
  components: {
    pre: Pre,
  },
}
