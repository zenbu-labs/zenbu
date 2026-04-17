# Architecture Overview

## Package Structure

`@pierre/diffs` ships 4 entry points:

| Entry                        | Purpose                                      |
|------------------------------|----------------------------------------------|
| `@pierre/diffs`              | Core: classes, parsers, renderers, utilities  |
| `@pierre/diffs/react`        | React wrappers (thin) around core classes     |
| `@pierre/diffs/ssr`          | Server-side preloading helpers                |
| `@pierre/diffs/worker`       | `WorkerPoolManager` + worker script entry     |

Side-effect entry: `dist/components/web-components.js` — registers the `<diffs-container>` custom element and adopts `style.css` into its shadow DOM.

## Pipeline: Raw Text → Rendered Diff

```
Input (patch string or two files)
  │
  ▼
┌─────────────────────────┐
│  parsePatchFiles()      │  — splits multi-file patch on `diff --git` boundaries
│  parseDiffFromFile()    │  — uses jsdiff `createTwoFilesPatch` for two full files
│  processFile()          │  — parses hunks from unified diff format
└─────────┬───────────────┘
          │ produces FileDiffMetadata
          ▼
┌─────────────────────────┐
│ renderDiffWithHighlighter│  — Shiki `codeToHast` for syntax tokens
│                          │  — jsdiff `diffChars`/`diffWordsWithSpace` for intra-line
│                          │  — iterateOverDiff() walks hunks respecting viewport
└─────────┬───────────────┘
          │ produces ThemedDiffResult { code: HAST ElementContent[], themeStyles }
          ▼
┌─────────────────────────┐
│ DiffHunksRenderer       │  — processDiffResult() assembles rows, gutters, annotations
│ .renderDiff()           │  — renderFullAST() → hast-util-to-html → HTML string
└─────────┬───────────────┘
          │ HTML string
          ▼
┌─────────────────────────┐
│ FileDiff / File class   │  — manages <pre> inside <diffs-container> shadow DOM
│                         │  — theme injection, interaction manager, resize observer
│                         │  — VirtualizedFileDiff adds RenderRange + spacer buffers
└─────────────────────────┘
```

## Core Data Structures

### FileDiffMetadata
The central model. JSON-serializable representation of a single file's diff.

```ts
interface FileDiffMetadata {
  name: string;
  prevName?: string;
  type: 'change' | 'rename-pure' | 'rename-changed' | 'new' | 'deleted';
  hunks: Hunk[];
  deletionLines: string[];   // full old-file lines (or patch-only lines if isPartial)
  additionLines: string[];   // full new-file lines
  splitLineCount: number;
  unifiedLineCount: number;
  isPartial: boolean;        // true = patch-only, false = full file contents available
  cacheKey?: string;
  lang?: SupportedLanguages;
}
```

### Hunk
One `@@ -X,N +X,N @@` block:

```ts
interface Hunk {
  collapsedBefore: number;
  additionStart: number; additionCount: number; additionLines: number;
  deletionStart: number; deletionCount: number; deletionLines: number;
  hunkContent: (ContextContent | ChangeContent)[];
  splitLineStart: number; splitLineCount: number;
  unifiedLineStart: number; unifiedLineCount: number;
}
```

### ThemedDiffResult
Output of the highlighting pipeline:

```ts
interface ThemedDiffResult {
  code: { deletionLines: ElementContent[]; additionLines: ElementContent[] };
  themeStyles: string;
  baseThemeType: 'light' | 'dark' | undefined;
}
```

## DOM Architecture

The library uses Shadow DOM via a custom element `<diffs-container>` (tag name from `DIFFS_TAG_NAME`). Inside the shadow root:

- `style.css` is adopted as a constructed stylesheet
- Theme CSS injected via `<style data-theme-css>`
- Unsafe CSS via `<style data-unsafe-css>`
- `<pre>` elements with data attributes for layout:
  - `data-diff` or `data-file`
  - `data-diff-type="split"` or `"single"`
  - `data-overflow="scroll"` or `"wrap"`
  - `data-indicators="bars"` or `"classic"`
  - `data-background`
  - `data-disable-line-numbers`

Lines use CSS Grid layout with sticky number columns.

## Diff Algorithm

- **File-to-file diffing**: `jsdiff` library's `createTwoFilesPatch` (Myers algorithm variant)
- **Intra-line word/char highlighting**: `jsdiff`'s `diffChars` or `diffWordsWithSpace` per changed line pair
- **Patch parsing**: Custom regex-based parser splitting on `@@ ` headers and `diff --git` boundaries
