import type { CSSProperties } from "react"
import { useEffect, useId, useLayoutEffect, useRef } from "react"

/**
 * Process-wide cache of persistent <iframe> elements. Iframes live
 * permanently in a document.body-level fixed container; a `ViewCacheSlot`
 * measures its placeholder and writes matching absolute coords onto the
 * cached iframe. This avoids reparenting (which reloads iframes in some
 * browsers) while still giving each slot its own "window" over the page.
 *
 * Intended consumers:
 *  - `LeafPane` (renders chat tabs and hits this cache per tabId)
 *  - Preload drivers that want an iframe to be warm before anything
 *    actually claims it (e.g. the pooled-agent preload).
 *
 * The cache is keyed by a caller-supplied string. Callers are responsible
 * for keeping keys stable across mounts (e.g. use tab / session id, not
 * component instance ids).
 */

type Entry = {
  key: string
  src: string
  iframe: HTMLIFrameElement
  ready: Promise<void>
  resolveReady: () => void
  claimedBy: string | null
  onLoadCallbacks: Set<(win: Window) => void>
  lastRect: DOMRect | null
}

const cache = new Map<string, Entry>()
let container: HTMLDivElement | null = null

function ensureContainer(): HTMLDivElement {
  if (container && container.isConnected) return container
  const el = document.createElement("div")
  el.setAttribute("data-view-cache-container", "")
  Object.assign(el.style, {
    position: "fixed",
    top: "0px",
    left: "0px",
    width: "0px",
    height: "0px",
    pointerEvents: "none",
    zIndex: "0",
    overflow: "visible",
  } satisfies Partial<CSSStyleDeclaration>)
  document.body.appendChild(el)
  container = el
  return el
}

function createEntry(key: string, src: string): Entry {
  const host = ensureContainer()
  const iframe = document.createElement("iframe")
  iframe.src = src
  iframe.setAttribute("data-view-cache-key", key)
  Object.assign(iframe.style, {
    position: "absolute",
    border: "none",
    // Sized to zero and hidden until a slot claims it.
    top: "0px",
    left: "0px",
    width: "0px",
    height: "0px",
    visibility: "hidden",
    pointerEvents: "none",
  } satisfies Partial<CSSStyleDeclaration>)
  host.appendChild(iframe)

  let resolveReady!: () => void
  const ready = new Promise<void>((res) => {
    resolveReady = res
  })

  const entry: Entry = {
    key,
    src,
    iframe,
    ready,
    resolveReady,
    claimedBy: null,
    onLoadCallbacks: new Set(),
    lastRect: null,
  }
  iframe.addEventListener("load", () => {
    entry.resolveReady()
    const win = iframe.contentWindow
    if (win) {
      for (const cb of entry.onLoadCallbacks) {
        try {
          cb(win)
        } catch (err) {
          console.error("[view-cache] onLoad callback failed", err)
        }
      }
    }
  })
  return entry
}

/**
 * Ensure an iframe for `key` exists in the cache and has started loading.
 * Idempotent: calling with the same key returns the existing entry. If
 * called with a different `src` than the existing entry, the cache
 * replaces the iframe (old one destroyed).
 */
export function preloadView(opts: {
  key: string
  src: string
}): { key: string; ready: Promise<void> } {
  const existing = cache.get(opts.key)
  if (existing) {
    if (existing.src === opts.src) return { key: opts.key, ready: existing.ready }
    evictView(opts.key)
  }
  const entry = createEntry(opts.key, opts.src)
  cache.set(opts.key, entry)
  return { key: opts.key, ready: entry.ready }
}

/** Remove an iframe from the cache and destroy it. */
export function evictView(key: string): void {
  const entry = cache.get(key)
  if (!entry) return
  entry.iframe.remove()
  cache.delete(key)
}

/** Does this key have a live iframe in the cache? */
export function hasCachedView(key: string): boolean {
  return cache.has(key)
}

/** Is some slot currently claiming this key? */
export function isClaimedView(key: string): boolean {
  const entry = cache.get(key)
  return !!entry?.claimedBy
}

/** Get the live iframe element for a cached key (e.g. to call `.focus()`). */
export function getCachedIframe(key: string): HTMLIFrameElement | null {
  return cache.get(key)?.iframe ?? null
}

function positionIframeOver(entry: Entry, rect: DOMRect) {
  const iframe = entry.iframe
  iframe.style.top = `${rect.top}px`
  iframe.style.left = `${rect.left}px`
  iframe.style.width = `${rect.width}px`
  iframe.style.height = `${rect.height}px`
  iframe.style.visibility = "visible"
  iframe.style.pointerEvents = "auto"
  entry.lastRect = rect
}

function hideIframe(entry: Entry) {
  const iframe = entry.iframe
  iframe.style.width = "0px"
  iframe.style.height = "0px"
  iframe.style.visibility = "hidden"
  iframe.style.pointerEvents = "none"
  entry.lastRect = null
}

/**
 * Renders a placeholder <div> that measures itself and projects a cached
 * iframe over it. On first mount for a new key, creates the iframe.
 */
export function ViewCacheSlot({
  cacheKey,
  src,
  className,
  style,
  iframeStyle,
  hidden,
  onLoad,
}: {
  cacheKey: string
  src: string
  className?: string
  style?: CSSProperties
  /**
   * Style applied directly to the cached <iframe> element (not the slot
   * placeholder). Useful for `borderRadius` / `clipPath` since the iframe
   * lives in a body-level container and can't be clipped by the slot's
   * `overflow: hidden`. Applied/cleared on (re)claim.
   */
  iframeStyle?: CSSProperties
  hidden?: boolean
  onLoad?: (win: Window) => void
}) {
  const placeholderRef = useRef<HTMLDivElement | null>(null)
  const slotId = useId()

  // Register / update the onLoad callback whenever it changes.
  useEffect(() => {
    const entry = cache.get(cacheKey)
    if (!entry || !onLoad) return
    entry.onLoadCallbacks.add(onLoad)
    // If iframe already loaded by the time the slot mounts, fire immediately.
    entry.ready.then(() => {
      if (entry.iframe.contentWindow)
        try {
          onLoad(entry.iframe.contentWindow)
        } catch (err) {
          console.error("[view-cache] onLoad (ready) failed", err)
        }
    })
    return () => {
      entry.onLoadCallbacks.delete(onLoad)
    }
  }, [cacheKey, onLoad])

  // Claim / unclaim. Create the cache entry lazily on first claim.
  useLayoutEffect(() => {
    let entry = cache.get(cacheKey)
    if (!entry) {
      preloadView({ key: cacheKey, src })
      entry = cache.get(cacheKey)!
    } else if (entry.src !== src) {
      evictView(cacheKey)
      preloadView({ key: cacheKey, src })
      entry = cache.get(cacheKey)!
    }
    entry.claimedBy = slotId

    const el = placeholderRef.current
    if (!el) return

    const apply = () => {
      if (!entry!.claimedBy || entry!.claimedBy !== slotId) return
      if (hidden) {
        hideIframe(entry!)
        return
      }
      positionIframeOver(entry!, el.getBoundingClientRect())
      if (iframeStyle) {
        Object.assign(entry!.iframe.style, iframeStyle as Record<string, string>)
      }
    }
    apply()

    const ro = new ResizeObserver(apply)
    ro.observe(el)
    window.addEventListener("scroll", apply, true)
    window.addEventListener("resize", apply)

    return () => {
      ro.disconnect()
      window.removeEventListener("scroll", apply, true)
      window.removeEventListener("resize", apply)
      if (entry!.claimedBy === slotId) {
        entry!.claimedBy = null
        hideIframe(entry!)
        if (iframeStyle) {
          // Clear iframe style overrides we applied so a future claim
          // starts from a clean slate.
          for (const key of Object.keys(iframeStyle)) {
            ;(entry!.iframe.style as unknown as Record<string, string>)[key] = ""
          }
        }
      }
    }
  }, [cacheKey, src, hidden, slotId, iframeStyle])

  return (
    <div
      ref={placeholderRef}
      className={className}
      style={{
        position: "relative",
        // The placeholder is transparent; the iframe floats over it.
        ...style,
      }}
      data-view-cache-slot={cacheKey}
    />
  )
}
