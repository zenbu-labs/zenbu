# Chat Virtualization & Scroll Architecture

## Current Implementation (as of April 2026)

### Summary

The chat view uses **no virtualizer**. Instead it uses:
1. **Plain DOM rendering** with `content-visibility: auto` for browser-native render skipping
2. **`useAutoScroll` hook** (ported from OpenCode's `createAutoScroll`) for rock-solid scroll-to-bottom behavior
3. **`useChatEvents` hook** for windowed event loading with lazy page expansion
4. **`preserveScroll` pattern** (capture/restore via `useLayoutEffect`) for zero-shift content prepending

This replaces all previous attempts at JS-level virtualization.

---

## Key Files

| File | Purpose |
|------|---------|
| `lib/use-auto-scroll.ts` | Scroll-lock hook: ResizeObserver-driven follow-bottom, programmatic scroll tagging, wheel/selection unlock |
| `lib/use-chat-events.ts` | Windowed event loading over kyju collections with loadMore support |
| `components/MessageList.tsx` | Plain scroll container + content-visibility + autoscroll + scroll-up backfill |
| `ChatDisplay.tsx` | Wires useChatEvents → materializeMessages → MessageList |
| `lib/materialize.ts` | Converts raw AgentEvents into MaterializedMessage[] for rendering |

---

## How `useAutoScroll` Works

Ported from [OpenCode's `createAutoScroll`](https://github.com/anomalyco/opencode/blob/dev/packages/ui/src/hooks/create-auto-scroll.tsx) (Solid → React).

### Core behaviors

1. **ResizeObserver on content div** → when content height changes and we're "following" (not user-scrolled), immediately `scrollToBottom`. This is how streaming text stays pinned.

2. **Programmatic scroll tagging (`markAuto`)** — when we set `scrollTop` programmatically, we record `{ top, time }`. The scroll event handler checks `isAutoScroll()` — if the scroll event matches our tagged position within 1.5s, it's treated as programmatic (not user scroll). This prevents the feedback loop where our own `scrollTop` assignment triggers the scroll handler which tries to "unlock".

3. **Wheel up unlock** — `deltaY < 0` on the scroll container → `stop()` (set `userScrolled = true`). Exception: if the wheel target is inside a `[data-scrollable]` element (e.g. a code block with its own scroll), we don't unlock.

4. **Scroll event handler** — if `distanceFromBottom < threshold` → re-lock. If `isAutoScroll` → keep following. Otherwise → `stop()`.

5. **Settling window** — when `working` transitions from `true` to `false`, we keep `isActive()` returning true for 300ms so final content arriving after streaming ends still gets auto-scrolled.

6. **`overflowAnchor: "dynamic"`** — set to `"none"` when following (prevent browser from anchoring), `"auto"` when user-scrolled (let browser anchor normally).

7. **`suppressRef`** — used by `captureSnapshot`/`restoreSnapshot` to temporarily block the ResizeObserver from auto-scrolling during content prepend operations.

### API

```tsx
const autoScroll = useAutoScroll({ working: streaming })

// Attach to DOM
<div ref={autoScroll.scrollRef} onScroll={autoScroll.handleScroll}>
  <div ref={autoScroll.contentRef}>{children}</div>
</div>

// State
autoScroll.userScrolled              // boolean (ref-based, not reactive state)

// Imperative
autoScroll.forceScrollToBottom()     // force pin + clear userScrolled
autoScroll.resume()                  // same as forceScrollToBottom
autoScroll.pause()                   // manually set userScrolled = true

// For prepend operations
autoScroll.captureSnapshot()         // returns { scrollTop, scrollHeight }, sets suppressRef
autoScroll.restoreSnapshot(snapshot) // adjusts scrollTop by height delta, clears suppressRef
```

### HMR safety

All mutable state is in refs. Helper functions are stored in `helpersRef` so `useCallback`-memoized ref callbacks always call the latest versions. A no-deps `useEffect` re-attaches ResizeObserver and wheel listener on every render (they clean up before re-attaching).

---

## How `useChatEvents` Works

### Problem it solves

`useCollection(agent?.eventLog)` subscribes to ALL pages of the event log. For long sessions this loads everything into memory at once. `useChatEvents` wraps `useCollection` with a sliding render window so only the last N events are exposed to the component tree.

### How it works

```
allEvents: [e0, e1, e2, ..., e499]  (500 events from useCollection)
                          ^
                     effectiveStart = 300 (initialWindow = 200)

events:    [e300, e301, ..., e499]   (200 events exposed to MessageList)
```

- **Initial load**: exposes the last `initialWindow` (default 200) events
- **`loadMore(captureSnapshot)`**: moves `windowStart` back by `batchSize` (default 100), exposing earlier events
- **`captureSnapshot`** is called by the caller before the state change, so the scroll position can be restored after React commits the prepended content

### Interaction with kyju

- Uses `useCollection` under the hood — full subscribe to all pages
- The windowing is purely client-side: `allEvents.slice(effectiveStart)`
- Live streaming updates (new events appended via `collection.concat`) flow through normally because `useCollection` handles the subscription
- When the collection ID changes (switching agents), the window resets to the tail

### Future: true page-level GC

The kyju replica was fixed (in this session) to **merge** pages on `collection.read` instead of replacing the entire collection. This means a future version of `useChatEvents` could:
1. Subscribe to only the tail pages (via `pageIds` parameter)
2. `collection.read` older pages on demand
3. Mark old pages as cold (drop their items from replica memory)
4. Re-fetch if the user scrolls back

The replica fix is in `packages/kyju/src/v2/replica/replica.ts` — the `collection.read` handler now merges new pages into existing collection state instead of replacing it. Two tests were added in `packages/kyju/test/replica.test.ts` to verify this merge behavior.

---

## How Content Prepending Works (preserveScroll)

When the user scrolls up past `scrollTop < 200px` and there are more events to show:

1. **Scroll handler** in MessageList detects the threshold
2. Calls `onLoadMore(captureSnapshot)` where `captureSnapshot`:
   - Records `{ scrollTop, scrollHeight }` from the scroll element
   - Sets `suppressRef = true` in useAutoScroll (blocks ResizeObserver from auto-scrolling)
   - Stores the snapshot in `pendingSnapshotRef`
3. `useChatEvents.loadMore` calls `setWindowStart()` — React queues a re-render with more events
4. React commits the DOM with prepended messages
5. `useLayoutEffect([messages])` in MessageList fires **synchronously before paint**:
   - Reads `pendingSnapshotRef.current`
   - Calls `autoScroll.restoreSnapshot(snapshot)`:
     - `el.scrollTop = snapshot.scrollTop + (el.scrollHeight - snapshot.scrollHeight)`
     - Clears `suppressRef`
6. Browser paints — viewport is in the identical visual position

This is the same pattern OpenCode uses (`preserveScroll` in `session.tsx`), adapted for React's async rendering model where the DOM commit happens in `useLayoutEffect` rather than synchronously after a Solid store update.

---

## MessageList Rendering

### Structure

```html
<div ref={scrollRef} onScroll={handleScroll} class="overflow-y-auto">
  <div ref={contentRef} class="max-w-[735px] space-y-1.5">
    <!-- "Loading..." indicator when hasMore -->
    <!-- messages.map() with content-visibility on non-active items -->
    <!-- Loading indicator when streaming + last msg is thinking -->
  </div>
</div>
```

### content-visibility

Non-active messages (all except the last) get:
```css
content-visibility: auto;
contain-intrinsic-size: auto 500px;
```

This tells the browser to skip rendering off-screen items while reserving ~500px of space. The browser handles virtualization natively — no JS virtualizer needed. The `auto` keyword means once measured, the browser remembers the real size.

### Scrollbar

Hidden by default (`scrollbar-width: none`), shown as a thin thumb on hover:
```css
scrollbar-width: none;
&:hover { scrollbar-width: thin; scrollbar-color: neutral-300 transparent; }
```

This prevents the scrollbar from flashing during auto-scroll.

---

## What Was Tried Before (and why it was abandoned)

### Attempt 1: Vendored react-virtuoso

Forked react-virtuoso into `packages/virtuoso/` with a sync script. Problems:
- 6000 lines / 59 files for 2 imports
- `followOutput` system used async ResizeObserver → 1-2 frame scroll lag during streaming
- Complex urx reactive stream engine fought with external scroll management
- Couldn't scroll up without getting pulled back down
- Internal invariant corruption after extended use

### Attempt 2: Oracle-native virtualizer with pretext

Built a custom 240-line virtualizer that used pretext (text measurement library) to compute item heights synchronously. Problems:
- ~1200px height mismatch between oracle and actual DOM (Streamdown's code block chrome, margins, etc.)
- Required matching every CSS detail of Streamdown's rendering
- Vendored Streamdown to make its layout explicit — still couldn't close the gap
- The fundamental issue: accurately computing markdown render height without rendering is nearly impossible

### Attempt 3: Content-visibility + useAutoScroll (current)

Inspired by OpenCode's architecture. No virtualizer at all:
- Plain scroll container with `content-visibility: auto` for render skipping
- `useAutoScroll` hook for bottom-locking (ported from OpenCode's battle-tested Solid implementation)
- `useChatEvents` for windowed event loading

This approach works because it doesn't try to predict heights — it lets the browser handle layout and uses ResizeObserver to react to changes. The `markAuto` tagging trick prevents the scroll handler from treating our programmatic scrolls as user scrolls.

---

## Packages Modified

| Package | What changed |
|---------|-------------|
| `packages/init` | New: `use-auto-scroll.ts`, `use-chat-events.ts`. Rewritten: `MessageList.tsx`, `ChatDisplay.tsx`. Restored: `ToolCallCard.tsx` (local useState for expand). Removed: `height-oracle.ts`, `markdown-measure.ts`, `font-config.ts`, `@zenbu/virtuoso` dep, `@chenglou/pretext` dep |
| `packages/kyju` | Fixed: `replica.ts` `collection.read` now merges pages instead of replacing. Added: 2 tests in `replica.test.ts` |
| `packages/virtuoso` | **Deleted entirely** (was the custom oracle virtualizer) |
| `packages/streamdown` | **Deleted entirely** (was a vendored fork, no longer needed) |
| `packages/agent` | Fixed: `serialize-event-log.ts` guard for `update.content` being undefined |

---

## Dependencies Removed

- `@zenbu/virtuoso` (workspace package, deleted)
- `@zenbu/streamdown` (workspace package, deleted)
- `@chenglou/pretext` (npm, removed from kernel)
- `marked` (npm, removed from kernel — was used by markdown-measure)

## Dependencies Added

- None. The current implementation uses only React, the existing kyju collection system, and browser APIs (ResizeObserver, content-visibility).
