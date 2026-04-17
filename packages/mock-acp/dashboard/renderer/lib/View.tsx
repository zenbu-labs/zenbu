import type { CSSProperties } from "react"

type ViewProps = {
  id: string
  src: string
  serverPort: number
  hidden?: boolean
  className?: string
  style?: CSSProperties
}

export function View({ id, src, serverPort, hidden, className, style }: ViewProps) {
  const hostname = id.toLowerCase().replace(/[^a-z0-9]/g, "")
  const iframeSrc = `http://${hostname}.localhost:${serverPort}${src}&wsPort=${serverPort}`

  return (
    <iframe
      key={id}
      src={iframeSrc}
      className={className}
      style={{
        border: "none",
        display: hidden ? "none" : "block",
        ...style,
      }}
    />
  )
}
