# Virtualizer Invariant Specification

## Core Invariants

### 1. First Frame Rendering
- On mount with locked-to-bottom: the bottom items MUST be visible on the very first paint
- No blank frames allowed — use synchronous bottom-fill measurement until viewport is covered
- Cold-start bootstrap renders only the bottom slice, expands upward via sync DOM reads in useLayoutEffect

### 2. Tab Switch Restore
- Switching away captures: snapshot geometry (DOM-measured offsets/sizes), measurement cache, materialized items, accordion state, scroll position
- Switching back restores the exact visual state with zero layout shift
- Snapshot mode stays authoritative until live model converges or user scrolls
- Free-scroll restore must translate snapshot anchor to live coordinates before user interaction

### 3. Scroll Lock Behavior
- Locked-to-bottom: viewport always shows the true bottom edge of rendered content
- Lock ONLY breaks on explicit user scroll intent (wheel up, touch drag up, scrollbar drag up)
- Lock NEVER breaks from: measurement changes, streaming content, accordion resize, estimate corrections, or any programmatic scroll
- Re-lock ONLY happens when user explicitly scrolls back to bottom (not from drift)

### 4. Free-Scroll Anchoring
- When user scrolls up, an anchor is captured (item key + pixel offset from item top)
- All subsequent layout changes (measurement updates, item insertions) must preserve the anchor's visual position
- Scroll compensation must be applied synchronously before paint via ResizeObserver callback
- Anchor uses item key (not index) so it survives materialization changes

### 5. Measurement System
- Items are measured via ResizeObserver on the outer virtual item wrapper
- When a node's cacheKey changes (same DOM element, different content identity), metadata must be updated and the node re-measured immediately
- Measurement cache entries are keyed by cacheKey, not by item key
- Streaming text blocks use a stable cacheKey for the duration of the stream to avoid estimate→measure cycles
- Measurement cache is exported with DOM-corrected heights at snapshot capture time

### 6. Render Window Management
- Overscan is pixel-based, not item-count-based
- Rendered range has retention/hysteresis: items stay mounted until they're well outside the retain band
- Mount/unmount boundary must never be visible inside the viewport
- Unmeasured items are clipped to their estimated height to prevent visual overlap

### 7. Block-Level Virtualization
- Messages are split into render blocks (paragraphs, code chunks, tool calls, tables, etc.)
- Each block is an independent virtual item with its own measurement identity
- Block structure (isFirstInMessage, isLastInMessage) is derived from the full materialized window, NOT from the current rendered set
- Headers and separators are structural, never dependent on which siblings are currently virtualized

### 8. Accordion Behavior
- Accordion open/close state is lifted to tab-level persisted state
- Accordion open state is NOT part of the measurement cache key — the same measured row can animate between states
- ResizeObserver drives height changes continuously during animation
- Accordion state is captured and restored with tab snapshots

### 9. Data Pipeline
- Materialized items can be seeded synchronously on mount (from persisted state)
- The materializer's appendEvents handles streaming deltas incrementally
- The materialization window can be hydrated from a snapshot to avoid async loading on restore

### 10. Model-DOM Consistency
- The core's scrollOffset and the DOM's scrollTop must agree after every programmatic write
- Every applyScrollOffset call updates both core.scrollOffset and scrollEl.scrollTop
- Offset drift from unmeasured prefix items is expected and not an invariant violation
- Size drift (where model size ≠ DOM size for a measured item) IS an invariant violation

## Test Scenarios

### Fuzz Actions
- Random scroll up/down by random pixel amounts
- Scroll to top / scroll to bottom
- Switch between tabs (A, B, C, Interactive)
- Toggle random accordion open/close
- Send a message in Interactive tab
- Enable/disable auto-streaming
- Toggle measurement cache restore
- Resize the viewport

### Assertions After Each Action
- No visible overlap: for any two adjacent rendered items, item[n].offset + item[n].size ≤ item[n+1].offset (within 1px tolerance)
- Scroll position consistency: |core.scrollOffset - scrollEl.scrollTop| < 2px (unless snapshot mode)
- Visible range validity: all items in the visible range have corresponding DOM nodes
- Total size consistency: spacer div height matches virtualizer.totalSize
- Measurement cache consistency: for rendered measured items, |cache.get(cacheKey).height - domNode.height| < 2px
- No negative offsets: all rendered item offsets ≥ 0
- Monotonic offsets: rendered items are sorted by offset
- Container coverage: rendered items cover the viewport (no gaps visible to user)
