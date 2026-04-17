# Performance Guide

## The Expensive Operations (ranked)

### 1. Shiki Tokenization (`codeToHast`)
**By far the dominant cost.** Grammar-based tokenization is O(n) in file size but with high constant factors (regex engine, grammar state machine). For a 1000-line TypeScript file, this can take 50-200ms on the main thread.

**Mitigations:**
- Use `WorkerPoolManager` to move off main thread (8 parallel workers by default)
- Set `tokenizeMaxLineLength: N` to skip tokenization for very long lines
- Use `preferredHighlighter: 'shiki-js'` (JavaScript regex engine) over `'shiki-wasm'` — JS engine is faster for most cases
- Use `cacheKey` on `FileContents` / `FileDiffMetadata` to leverage LRU caching

### 2. Intra-line Diff Computation (`diffChars`/`diffWordsWithSpace`)
Called per changed line pair. Individually cheap, but adds up with many changed lines.

**Mitigations:**
- `maxLineDiffLength: 1000` (default) — skips for long lines
- `lineDiffType: 'none'` — disables entirely
- For diffs >1000 lines, the library auto-disables intra-line diffs when rendering plain text AST:
  ```ts
  // Automatic in renderDiffWithHighlighter:
  if (forcePlainText && (diff.unifiedLineCount > 1000 || diff.splitLineCount > 1000)) {
    lineDiffType = 'none';
  }
  ```

### 3. HAST-to-HTML Serialization (`hast-util-to-html`)
Converting HAST trees to HTML strings. Linear in the number of nodes but involves string concatenation for potentially thousands of spans.

### 4. DOM Insertion (`innerHTML`)
Setting `innerHTML` on `<pre>` elements with large HTML strings triggers Chromium's HTML parser. For very large diffs this can cause layout thrash.

**Mitigations:**
- Virtualization (only render visible lines)
- The plain-first strategy shows content faster while highlighted AST builds in background

### 5. Virtualization Overhead
`VirtualizedFileDiff.reconcileHeights` measures DOM row heights for annotations/wrapped lines. Uses `ResizeObserver` + `IntersectionObserver`.

## Anti-patterns to Avoid

### Re-rendering without `cacheKey`
Without `cacheKey`, the worker pool cannot cache results. Every `render()` call triggers full re-tokenization.

### Unnecessary `rerender()` calls
`setOptions()` does NOT trigger re-render — you must call `rerender()` explicitly (or the Virtualizer handles it). Avoid calling `rerender()` after every option change; batch them.

### Large diffs without virtualization
A 5000-line unified diff generates ~15,000+ DOM nodes (lines × columns × spans). Without virtualization this will jank on scroll.

### `diffChars` on huge lines
A single 10,000-character line with `lineDiffType: 'char'` will run `diffChars` which is O(n*m). The `maxLineDiffLength` guard prevents this.

### Creating multiple highlighter instances
The library ensures one highlighter per thread via `getSharedHighlighter()`. Don't create your own — each instance loads all grammar data.

## Performance Budgets (rough Chromium numbers)

| Operation                       | ~Time (1000-line TS file) |
|---------------------------------|---------------------------|
| `parseDiffFromFile`             | 1-5ms                     |
| `parsePatchFiles`               | <1ms                      |
| Plain text AST render           | 5-15ms                    |
| Shiki tokenization (main)       | 50-200ms                  |
| Shiki tokenization (worker)     | same, but non-blocking    |
| DOM insertion (1000 lines)      | 10-30ms                   |
| Intra-line diffs (100 changes)  | 5-20ms                    |

## Recommended Setup for Large Diffs

1. **Always** use `WorkerPoolManager` with `poolSize: navigator.hardwareConcurrency`
2. **Always** use `VirtualizedFileDiff` with a `Virtualizer`
3. Set `cacheKey` on all inputs
4. Use `collapsedContextThreshold: 2` to auto-expand tiny context blocks
5. Consider `lineDiffType: 'word-alt'` over `'char'` (fewer spans, better visuals)
6. For preview scenarios, use `getPlainDiffAST()` with a tight `RenderRange`
