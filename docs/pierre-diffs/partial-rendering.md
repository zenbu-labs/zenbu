# Partial Diff Rendering

## The Problem

For a 1000-line file, diffing and highlighting all 1000 lines just to show a 20-line preview window is wasteful. The library has partial rendering support, but with important constraints.

## RenderRange

The core windowing primitive:

```ts
interface RenderRange {
  startingLine: number;  // first visible line index
  totalLines: number;    // number of lines to render
  bufferBefore: number;  // spacer height (px) before rendered lines
  bufferAfter: number;   // spacer height (px) after rendered lines
}
```

## Constraint: Plain Text Only for Windowed Rendering

**Syntax highlighting requires the full file content** for correct grammar state (e.g., a string literal that starts on line 1 affects tokenization on line 500). The library enforces this:

```ts
// From renderDiffWithHighlighter.ts
if (forcePlainText) {
  startingLine ??= 0;
  totalLines ??= Infinity;
} else {
  // Full file must be highlighted for correct grammar
  startingLine = 0;
  totalLines = Infinity;
}
```

So for windowed/partial rendering:

| Mode                    | Supports RenderRange? | Syntax Highlighting? |
|-------------------------|-----------------------|----------------------|
| `forcePlainText: true`  | Yes                   | No                   |
| `forcePlainText: false` | No (resets to full)   | Yes                  |

## The Right Approach for Preview Windows

### Strategy 1: Plain-first, Highlight-async (recommended)

1. **Immediately** render a plain text window via `getPlainDiffAST(diff, startLine, totalLines)` — this respects the range and is fast
2. **In background** via worker: highlight the full diff AST
3. **On callback**: replace the plain AST with the highlighted one, sliced to the window

This is exactly what `VirtualizedFileDiff` does.

### Strategy 2: Pre-slice the content

If you truly want to avoid processing 1000 lines:

```ts
import { parseDiffFromFile } from '@pierre/diffs';

// Only diff the visible window
const windowOld = { name: 'file.ts', contents: oldLines.slice(start, end).join('\n') };
const windowNew = { name: 'file.ts', contents: newLines.slice(start, end).join('\n') };
const partialDiff = parseDiffFromFile(windowOld, windowNew);
// Render this smaller diff normally
```

**Caveat**: This changes the diff semantics — hunks won't have correct line numbers, and context around the window boundary is lost.

### Strategy 3: Render full diff, CSS-clip the viewport

Render the full diff but use `overflow: hidden` + `transform: translateY()` to show only a window. The DOM is fully built but only a portion is visible. This preserves highlighting correctness but pays the full render cost.

### Strategy 4: Shiki grammarState streaming (advanced)

The library exposes `ShikiStreamTokenizer` and `CodeToTokenTransformStream` in `@pierre/diffs` (from `./shiki-stream`). These carry grammar state line-by-line. In theory you could:

1. Pre-tokenize lines 1–N and cache the `grammarState` at line N
2. For a window starting at line N, resume tokenization from the cached state
3. Only tokenize the visible window with correct highlighting

This is not built into the diff pipeline but the primitives exist.

## iterateOverDiff Windowing

`iterateOverDiff()` accepts `startingLine` and `totalLines` and skips lines outside the window during iteration. This means the diff metadata processing (hunk walking, line pairing) is efficient — it doesn't allocate HAST nodes for invisible lines in plain mode.
