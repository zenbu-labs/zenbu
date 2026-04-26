import type { CSSProperties } from "react"
import { useCallback, useEffect, useId, useRef, useState } from "react"

/**
 * Cross-iframe draggable region protocol.
 *
 * Background: Chromium drops `-webkit-app-region` drag-region IPCs from
 * any non-primary-main-frame (`RenderFrameHostImpl::DraggableRegionsChanged`
 * early-returns when `!IsInPrimaryMainFrame()`). So CSS drag regions set
 * inside iframes are silently ignored — they only work in the orchestrator
 * window itself.
 *
 * This module lets any iframe (at any nesting depth) declare "this
 * rectangle should drag the OS window", and synthesizes the effect by:
 *
 *   1. Iframe: a `useDragRegion()` hook measures a ref'd element in
 *      viewport coords and posts heartbeats up the frame tree.
 *   2. Forwarder: every frame auto-installs a `message` listener. On
 *      receipt, it finds the child iframe that sent the message,
 *      translates the rect into its own viewport, and forwards to its
 *      parent.
 *   3. Top window: accumulates active regions in a registry. A
 *      `<DragRegionOverlay />` renders a transparent `WebkitAppRegion:
 *      drag` div over each rect, in the orchestrator's primary frame —
 *      where Chromium actually honors it.
 *
 * Heartbeats are required (default 200ms with 600ms TTL) so stale
 * registrations from reloaded / crashed iframes vanish without explicit
 * cleanup. Components also send an explicit `remove` event on unmount
 * for a clean disappearance.
 */

type Rect = { top: number; left: number; width: number; height: number }

const HEARTBEAT_MS = 200
const TTL_MS = 600

// ---------------------------------------------------------------------------
// Debug logging. Toggle via `localStorage.zenbuDragDebug = "1"` in any
// frame's devtools console, then reload. Logs include a frame tag so you
// can tell orchestrator / chat / etc. apart.
// ---------------------------------------------------------------------------

const DEBUG =
  typeof window !== "undefined" &&
  (() => {
    try {
      return window.localStorage?.getItem("zenbuDragDebug") === "1"
    } catch {
      return false
    }
  })()

function frameTag(): string {
  if (typeof window === "undefined") return "(no-window)"
  const isTopFrame = window.parent === window
  const host = window.location.hostname
  const path = window.location.pathname
  // Extract view scope from path (…/views/<scope>/…) or subdomain.
  const viewMatch = path.match(/\/views\/([^/]+)/)
  const scope =
    viewMatch?.[1] ??
    host.replace(/\.localhost$/, "").replace(/[^a-z0-9-]/gi, "") ??
    "?"
  return `${isTopFrame ? "TOP" : "sub"}:${scope}`
}

const TAG = frameTag()

// Per-frame random prefix so that `useId()` collisions across iframe React
// realms don't cause rect ping-pong at the top window's registry.
const FRAME_ID_PREFIX =
  typeof window !== "undefined"
    ? Math.random().toString(36).slice(2, 10)
    : "server"

function dlog(...args: unknown[]) {
  if (!DEBUG) return
  // eslint-disable-next-line no-console
  console.log(`[drag-region ${TAG}]`, ...args)
}

function dwarn(...args: unknown[]) {
  if (!DEBUG) return
  // eslint-disable-next-line no-console
  console.warn(`[drag-region ${TAG}]`, ...args)
}

const HEARTBEAT = "zenbu:drag-region:heartbeat"
const REMOVE = "zenbu:drag-region:remove"

type HeartbeatMsg = {
  type: typeof HEARTBEAT
  id: string
  rect: Rect
  ttlMs: number
}

type RemoveMsg = { type: typeof REMOVE; id: string }

type Msg = HeartbeatMsg | RemoveMsg

function isDragMsg(data: unknown): data is Msg {
  if (!data || typeof data !== "object") return false
  const t = (data as { type?: unknown }).type
  return t === HEARTBEAT || t === REMOVE
}

function translateRect(rect: Rect, byIframeRect: DOMRect): Rect {
  return {
    top: rect.top + byIframeRect.top,
    left: rect.left + byIframeRect.left,
    width: rect.width,
    height: rect.height,
  }
}

// ---------------------------------------------------------------------------
// Top-window registry: the single source of truth for what the orchestrator
// should draw as draggable overlays. Subscribers drive React re-renders.
// ---------------------------------------------------------------------------

type Entry = { id: string; rect: Rect; deadline: number }

const registry = new Map<string, Entry>()
const subscribers = new Set<() => void>()
let sweepHandle: ReturnType<typeof setInterval> | null = null

function notify() {
  for (const cb of subscribers) cb()
}

function commit(msg: Msg) {
  if (msg.type === HEARTBEAT) {
    const had = registry.has(msg.id)
    registry.set(msg.id, {
      id: msg.id,
      rect: msg.rect,
      deadline: performance.now() + Math.max(100, msg.ttlMs),
    })
    if (!had) {
      dlog("commit: register", msg.id, msg.rect, `total=${registry.size}`)
    }
  } else {
    if (!registry.delete(msg.id)) return
    dlog("commit: remove", msg.id, `total=${registry.size}`)
  }
  notify()
}

function startSweeper() {
  if (sweepHandle) return
  sweepHandle = setInterval(() => {
    const now = performance.now()
    let changed = false
    for (const [id, e] of registry) {
      if (e.deadline < now) {
        registry.delete(id)
        changed = true
      }
    }
    if (changed) notify()
  }, HEARTBEAT_MS)
}

function snapshot(): Entry[] {
  return [...registry.values()]
}

// ---------------------------------------------------------------------------
// Up-routing: each frame calls `sendUp` to push a msg one level toward the
// top window. The top window commits to the registry directly.
// ---------------------------------------------------------------------------

const isTop =
  typeof window !== "undefined" && window.parent === window

function sendUp(msg: Msg) {
  if (isTop) {
    commit(msg)
    return
  }
  try {
    window.parent.postMessage(msg, "*")
    if (msg.type === HEARTBEAT) {
      dlog("sendUp → parent heartbeat", msg.id, msg.rect)
    } else {
      dlog("sendUp → parent remove", msg.id)
    }
  } catch (err) {
    dwarn("sendUp failed", err)
  }
}

// ---------------------------------------------------------------------------
// Forwarder: every frame installs this on load. Receives messages from
// child iframes, translates their rects into this frame's viewport, and
// pushes up. The top window's `sendUp` commits to its registry instead of
// re-posting.
// ---------------------------------------------------------------------------

let forwarderInstalled = false

function installForwarder() {
  if (forwarderInstalled) return
  if (typeof window === "undefined") return
  forwarderInstalled = true
  dlog(
    "installForwarder",
    `isTop=${isTop}`,
    `iframes=${document.querySelectorAll("iframe").length}`,
  )

  window.addEventListener("message", (e) => {
    if (!isDragMsg(e.data)) return
    const src = e.source
    if (!src || src === window) return

    // Find the iframe element whose contentWindow posted this message.
    const iframes = document.querySelectorAll("iframe")
    let matched: HTMLIFrameElement | null = null
    for (const f of iframes) {
      if (f.contentWindow === src) {
        matched = f
        break
      }
    }
    if (!matched) {
      dwarn(
        "forwarder: no matching iframe for source",
        `type=${e.data.type}`,
        `id=${(e.data as any).id}`,
        `iframeCount=${iframes.length}`,
      )
      return
    }

    if (e.data.type === HEARTBEAT) {
      const childRect = matched.getBoundingClientRect()
      // Invisible / collapsed iframes (view-cache preload slots, hidden
      // tabs) shouldn't publish drag regions — their translated rects
      // would land at (0, 0) with tiny width/height and stomp the real
      // one when IDs happen to collide. The explicit `remove` still
      // flows; we just ignore heartbeats here.
      if (childRect.width < 2 || childRect.height < 2) {
        dlog(
          "forwarder: drop heartbeat from collapsed iframe",
          e.data.id,
          childRect,
        )
        return
      }
      const translated = translateRect(e.data.rect, childRect)
      dlog(
        "forwarder: recv heartbeat",
        e.data.id,
        "childRect=",
        childRect,
        "incomingRect=",
        e.data.rect,
        "→translated=",
        translated,
      )
      sendUp({ ...e.data, rect: translated })
    } else {
      dlog("forwarder: recv remove", e.data.id)
      sendUp(e.data)
    }
  })

  if (isTop) {
    startSweeper()
    dlog("sweeper started")
  }
}

installForwarder()

// ---------------------------------------------------------------------------
// Public API — hook
// ---------------------------------------------------------------------------

/**
 * Declare a draggable region tied to a DOM element. Returns a stable ref
 * callback; while an element is attached, its bounding rect is streamed
 * up to the top window and rendered as a transparent drag overlay.
 *
 * The ref callback owns the full lifecycle — start observers on attach,
 * clean up and send an explicit `remove` on detach/unmount — so no
 * re-rendering is required to drive the effect.
 */
export function useDragRegion<
  T extends HTMLElement = HTMLDivElement,
>(): React.RefCallback<T> {
  const rawId = useId()
  // Qualify the id with a per-frame random prefix so identical `useId`
  // values in sibling iframes (e.g. a preloaded chat view and the active
  // one) don't stomp each other in the top-window registry.
  const id = `${FRAME_ID_PREFIX}:${rawId}`
  const cleanup = useRef<(() => void) | null>(null)

  const refCb = useCallback(
    (el: T | null) => {
      // Detach: run prior cleanup regardless of whether we also attach a
      // new element. React calls the callback with `null` on unmount.
      if (cleanup.current) {
        dlog("hook: detach", id)
        cleanup.current()
        cleanup.current = null
      }
      if (!el) return
      dlog("hook: attach", id, el.tagName, el.getBoundingClientRect())

      let stopped = false
      const send = () => {
        if (stopped || !el.isConnected) return
        const r = el.getBoundingClientRect()
        sendUp({
          type: HEARTBEAT,
          id,
          rect: {
            top: r.top,
            left: r.left,
            width: r.width,
            height: r.height,
          },
          ttlMs: TTL_MS,
        })
      }

      send()
      const interval = setInterval(send, HEARTBEAT_MS)
      const ro = new ResizeObserver(send)
      ro.observe(el)
      window.addEventListener("scroll", send, true)
      window.addEventListener("resize", send)

      cleanup.current = () => {
        stopped = true
        clearInterval(interval)
        ro.disconnect()
        window.removeEventListener("scroll", send, true)
        window.removeEventListener("resize", send)
        sendUp({ type: REMOVE, id })
      }
    },
    [id],
  )

  // Safety net: if the component unmounts without React calling the ref
  // with `null` (e.g. StrictMode double-mount edge cases), still clean up.
  useEffect(() => {
    return () => {
      if (cleanup.current) {
        cleanup.current()
        cleanup.current = null
      }
    }
  }, [])

  return refCb
}

// ---------------------------------------------------------------------------
// Public API — overlay (top window only)
// ---------------------------------------------------------------------------

/**
 * Renders a transparent drag overlay for every active drag region. Mount
 * once in the orchestrator (the primary main frame). No-op in iframes.
 */
export function DragRegionOverlay({
  style,
  debug: debugProp,
}: {
  style?: CSSProperties
  /**
   * Tint the overlays so you can see the rects the system derived. When
   * omitted, defaults to whatever `localStorage.zenbuDragDebug` is set to.
   */
  debug?: boolean
}) {
  const [rects, setRects] = useState<Entry[]>(() => snapshot())
  const debug = debugProp ?? DEBUG

  useEffect(() => {
    if (!isTop) return
    const cb = () => setRects(snapshot())
    subscribers.add(cb)
    dlog("overlay subscribed")
    return () => {
      subscribers.delete(cb)
      dlog("overlay unsubscribed")
    }
  }, [])

  if (!isTop) return null
  if (DEBUG) dlog("overlay render", `count=${rects.length}`, rects)

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 2147483000,
        ...style,
      }}
    >
      {rects.map((e) => (
        <div
          key={e.id}
          style={
            {
              position: "absolute",
              top: e.rect.top,
              left: e.rect.left,
              width: e.rect.width,
              height: e.rect.height,
              background: debug ? "rgba(0, 150, 255, 0.15)" : "transparent",
              outline: debug ? "1px dashed rgba(0, 150, 255, 0.6)" : "none",
              WebkitAppRegion: "drag",
              pointerEvents: "auto",
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}
