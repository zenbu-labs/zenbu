# Feature Catalog

## Core Rendering

| Feature                    | Description                                                 |
|----------------------------|-------------------------------------------------------------|
| Unified diff view          | Standard line-by-line unified diff (`diffStyle: 'unified'`) |
| Split diff view            | Side-by-side old/new (`diffStyle: 'split'`)                 |
| File viewer                | Single file with syntax highlighting (no diff)              |
| Streaming file viewer      | `FileStream` for real-time content (e.g., AI output)        |
| Multi-file diff            | `MultiFileDiff` React component for patch-level diffs       |
| Patch diff                 | `PatchDiff` React component for raw patch strings           |
| Merge conflict viewer      | `UnresolvedFile` for 3-way merge conflict display           |

## Syntax Highlighting

| Feature                    | Description                                                 |
|----------------------------|-------------------------------------------------------------|
| Shiki 3 integration        | Grammar-based tokenization via TextMate grammars            |
| 200+ languages             | All Shiki bundled languages                                 |
| Dual theme support         | `{dark, light}` theme pairs with `color-scheme` CSS         |
| CSS variable themes        | `createCSSVariablesTheme` for fully custom theming          |
| Custom themes              | `registerCustomTheme` for custom Shiki themes               |
| Custom languages           | `registerCustomLanguage` for custom TextMate grammars       |
| Token transformer          | `useTokenTransformer` for `data-char` span attributes       |
| CSS classes mode           | `useCSSClasses` for `hl-*` class-based tokens               |
| ANSI highlighting          | Terminal escape code rendering                              |

## Diff Intelligence

| Feature                    | Description                                                 |
|----------------------------|-------------------------------------------------------------|
| Intra-line word diffs      | `diffWordsWithSpace` highlighting within changed lines      |
| Intra-line char diffs      | `diffChars` character-level highlighting                    |
| Word-alt mode              | Joins adjacent single-char diff spans for cleaner display   |
| Hunk context collapse      | Collapsed unchanged lines between hunks                     |
| Hunk expansion             | Click to expand collapsed context (configurable chunk size) |
| Auto-expand small context  | `collapsedContextThreshold` auto-expands tiny context       |
| Accept/reject hunks        | `diffAcceptRejectHunk` utility for code review flows        |

## Virtualization

| Feature                    | Description                                                 |
|----------------------------|-------------------------------------------------------------|
| `Virtualizer`              | `IntersectionObserver` + `ResizeObserver` based             |
| `VirtualizedFileDiff`      | Diff with render range windowing                            |
| `VirtualizedFile`          | File with render range windowing                            |
| `AdvancedVirtualizer`      | Multi-file + sticky header layout                           |
| Spacer buffers             | `bufferBefore`/`bufferAfter` spacer divs for scroll position|
| Overscroll                 | ~1000px default overscroll buffer                           |

## Interaction

| Feature                    | Description                                                 |
|----------------------------|-------------------------------------------------------------|
| Line hover highlighting    | Configurable highlight on hover                             |
| Line click events          | Click handlers per line                                     |
| Line number click events   | Separate handlers for gutter clicks                         |
| Line selection             | Multi-line range selection with drag                        |
| Token hover events         | Hover handlers per syntax token                             |
| Token click events         | Click handlers per token                                    |
| Gutter utility widget      | Custom hover widget in gutter area                          |
| Scroll sync                | `ScrollSyncManager` for syncing split columns               |

## File Header

| Feature                    | Description                                                 |
|----------------------------|-------------------------------------------------------------|
| Default header             | File name + change type badge                               |
| Custom header prefix       | `renderHeaderPrefix` slot                                   |
| Custom header metadata     | `renderHeaderMetadata` slot                                 |
| Fully custom header        | `renderCustomHeader` replaces entire header                 |
| Collapsible files          | `collapsed` option with header toggle                       |
| Disable header             | `disableFileHeader` hides it entirely                       |

## Annotations

| Feature                    | Description                                                 |
|----------------------------|-------------------------------------------------------------|
| Line annotations           | Attach custom elements to specific lines                    |
| Diff line annotations      | Side-aware annotations (deletions/additions)                |
| Annotation rendering       | `renderAnnotation` callback for custom annotation UI        |

## Merge Conflicts

| Feature                    | Description                                                 |
|----------------------------|-------------------------------------------------------------|
| Conflict detection         | Parses `<<<<<<<`, `=======`, `>>>>>>>` markers              |
| 3-way support              | Handles `|||||||` base markers                              |
| Resolution actions         | Accept current, incoming, or both                           |
| Context trimming           | `maxContextLines` for conflict region display               |

## Worker Pool

| Feature                    | Description                                                 |
|----------------------------|-------------------------------------------------------------|
| Pool of N workers          | Default 8, configurable                                     |
| LRU AST cache              | Deduplication via `cacheKey`                                |
| Language-aware scheduling   | Workers track loaded languages for optimal routing          |
| Theme hot-swap             | `setRenderOptions` updates all workers                      |
| Stats monitoring           | `subscribeToStatChanges` for pool metrics                   |
| Portable worker script     | `worker-portable.js` for bundler compatibility              |

## Streaming

| Feature                    | Description                                                 |
|----------------------------|-------------------------------------------------------------|
| `FileStream`               | Render file content as it streams in                        |
| `ShikiStreamTokenizer`     | Line-by-line tokenization with `grammarState` carry-over    |
| `CodeToTokenTransformStream`| `TransformStream` for chunked input processing             |

## Utilities

| Feature                    | Description                                                 |
|----------------------------|-------------------------------------------------------------|
| `parsePatchFiles`          | Parse multi-file patch strings                              |
| `parseDiffFromFile`        | Diff two `FileContents` objects                             |
| `trimPatchContext`         | Reduce context lines in a patch                             |
| `codeToHtml`               | Re-exported Shiki utility for ad-hoc highlighting           |
| `SVGSpriteSheet`           | Icon sprite for file type icons                             |
| `resolveLanguage`          | Async language grammar resolution                           |
| `resolveTheme`             | Async theme resolution                                      |
| `preloadHighlighter`       | Pre-warm the shared highlighter                             |
