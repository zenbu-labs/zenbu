import { useState, useEffect, useRef, useCallback } from "react"
import { useRpc } from "../../lib/ws-connection"

interface HtopData {
  uptime: string
  memory: { heapUsed: number; heapTotal: number; rss: number }
  cpuPct: number
  services: Array<{
    pid: number
    key: string
    status: string
    deps: string
    methodCount: number
  }>
  counts: { ready: number; failed: number; blocked: number; total: number }
  webContentsCount: number
  consoleCount: number
}

const STYLE_CLASSES: Record<string, string> = {
  error: "text-red-400",
  success: "text-green-400",
  info: "text-blue-400",
  dim: "text-neutral-500",
  warn: "text-amber-400",
  header: "text-cyan-400",
}

function p(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length)
}

function mb(bytes: number): number {
  return Math.round(bytes / 1024 / 1024)
}

function Bar({
  value,
  max,
  width = 28,
}: {
  value: number
  max: number
  width?: number
}) {
  const ratio = max > 0 ? Math.min(value / max, 1) : 0
  const filled = Math.round(ratio * width)
  const empty = width - filled
  const pct = ratio * 100
  const color =
    pct < 50
      ? "text-green-400"
      : pct < 80
        ? "text-amber-400"
        : "text-red-400"
  return (
    <>
      <span className="text-neutral-600">[</span>
      <span className={color}>{"█".repeat(filled)}</span>
      <span className="text-neutral-800">{"░".repeat(empty)}</span>
      <span className="text-neutral-600">]</span>
    </>
  )
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "ready"
      ? "text-green-400"
      : status === "failed"
        ? "text-red-400"
        : "text-amber-400"
  return <span className={color}>●</span>
}

type DagLine = { text: string; style?: string }

export function Htop({ onExit }: { onExit: () => void }) {
  const rpc = useRpc()
  const [data, setData] = useState<HtopData | null>(null)
  const [dagLines, setDagLines] = useState<DagLine[]>([])
  const [tab, setTab] = useState<"table" | "dag">("table")
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    const poll = async () => {
      try {
        const [d, dag] = await Promise.all([
          rpc["view-shell"].htopData(),
          rpc["view-shell"].htopDag(),
        ])
        if (active) {
          setData(d as HtopData)
          setDagLines((dag as any).lines ?? [])
        }
      } catch {}
    }
    poll()
    const id = setInterval(poll, 1000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [rpc])

  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "q" || e.key === "Escape") {
        e.preventDefault()
        onExit()
      }
      if (e.key === "d") {
        e.preventDefault()
        setTab("dag")
      }
      if (e.key === "t") {
        e.preventDefault()
        setTab("table")
      }
    },
    [onExit],
  )

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0a0a0a] font-mono text-sm text-neutral-600">
        loading…
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto bg-[#0a0a0a] px-4 pt-3 pb-3 font-mono text-[13px] leading-[1.55] select-text outline-none"
      style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div className="whitespace-pre">
        {/* title */}
        <div className="flex justify-between">
          <span className="text-white font-bold">
            zenbu — runtime monitor
          </span>
          <span className="text-neutral-500">up {data.uptime}</span>
        </div>

        <div className="mt-3" />

        {/* resource bars */}
        <div className="text-neutral-400">
          <div>
            <span className="text-neutral-500">{"  Mem "}</span>
            <Bar value={data.memory.rss} max={Math.max(data.memory.rss * 2, 512 * 1024 * 1024)} />
            <span className="text-neutral-400">
              {"  "}
              {mb(data.memory.rss)} MB
            </span>
          </div>
          <div>
            <span className="text-neutral-500">{"  CPU "}</span>
            <Bar value={data.cpuPct} max={100} />
            <span className="text-neutral-400">
              {"  "}
              {data.cpuPct.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="mt-3" />

        {/* summary stats */}
        <div className="text-neutral-500">
          <div>
            {"  "}Services:{" "}
            <span className="text-neutral-200">{data.counts.total}</span>
            {"      "}
            <span className="text-green-400">{data.counts.ready}</span> ready
            {"   "}
            <span
              className={
                data.counts.failed > 0 ? "text-red-400" : "text-neutral-600"
              }
            >
              {data.counts.failed}
            </span>{" "}
            failed{"   "}
            <span
              className={
                data.counts.blocked > 0
                  ? "text-amber-400"
                  : "text-neutral-600"
              }
            >
              {data.counts.blocked}
            </span>{" "}
            blocked
          </div>
          <div>
            {"  "}WebContents:{" "}
            <span className="text-neutral-200">
              {data.webContentsCount}
            </span>
            {"     "}Console:{" "}
            <span className="text-neutral-200">{data.consoleCount}</span>{" "}
            buffered
          </div>
        </div>

        <div className="mt-3" />

        {/* separator */}
        <div className="text-neutral-700">
          {tab === "table"
            ? "  ─── service table "
            : "  ─── dependency dag "}
          {"─".repeat(46)}
        </div>

        <div className="mt-1.5" />

        {tab === "table" ? (
          <>
            {/* table header */}
            <div className="text-neutral-500">
              {"  "}
              {p("PID", 6)}
              {p("SERVICE", 22)}
              {p("STATUS", 14)}
              {p("DEPS", 30)}
              {"RPC"}
            </div>

            <div className="mt-0.5" />

            {/* service rows */}
            {data.services.map((svc) => {
              const deps =
                svc.deps.length > 28
                  ? svc.deps.slice(0, 26) + "…"
                  : svc.deps
              return (
                <div key={svc.key}>
                  {"  "}
                  <span className="text-neutral-600">
                    {p(String(svc.pid), 6)}
                  </span>
                  <span className="text-neutral-200">
                    {p(svc.key, 22)}
                  </span>
                  <StatusDot status={svc.status} />{" "}
                  <span
                    className={
                      svc.status === "ready"
                        ? "text-neutral-400"
                        : svc.status === "failed"
                          ? "text-red-400"
                          : "text-amber-400"
                    }
                  >
                    {p(svc.status, 12)}
                  </span>
                  <span className="text-neutral-600">
                    {p(deps, 30)}
                  </span>
                  <span className="text-neutral-600">
                    {svc.methodCount}
                  </span>
                </div>
              )
            })}
          </>
        ) : (
          <>
            {dagLines.map((line, i) => {
              const cls = line.style
                ? STYLE_CLASSES[line.style] ?? "text-neutral-300"
                : "text-neutral-300"
              return (
                <div key={i} className={cls}>
                  {line.text || "\u00A0"}
                </div>
              )
            })}
          </>
        )}

        <div className="mt-4" />

        {/* footer */}
        <div className="text-neutral-600">
          {"  "}q exit{"   "}
          {tab === "table" ? (
            <span>
              d <span className="text-neutral-500">dag</span>
            </span>
          ) : (
            <span>
              t <span className="text-neutral-500">table</span>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
