# Customization Reference

## Component Options (Props)

### BaseCodeOptions (shared by all components)

| Option                          | Type                              | Default          | Description                                    |
|---------------------------------|-----------------------------------|------------------|------------------------------------------------|
| `theme`                         | `DiffsThemeNames \| ThemesType`   | pierre-dark/light| Shiki theme name or `{dark, light}` pair       |
| `themeType`                     | `'system' \| 'light' \| 'dark'`  | `'system'`       | Which theme to use                             |
| `overflow`                      | `'scroll' \| 'wrap'`             | `'scroll'`       | Line overflow behavior                         |
| `collapsed`                     | `boolean`                         | `false`          | Collapse the entire diff                       |
| `disableLineNumbers`            | `boolean`                         | `false`          | Hide line number gutters                       |
| `disableFileHeader`             | `boolean`                         | `false`          | Hide the file header bar                       |
| `disableVirtualizationBuffers`  | `boolean`                         | `false`          | Disable spacer divs for virtualization         |
| `preferredHighlighter`          | `'shiki-js' \| 'shiki-wasm'`     | `'shiki-js'`     | Shiki engine (JS regex vs Oniguruma WASM)      |
| `useCSSClasses`                 | `boolean`                         | `false`          | Use CSS classes instead of inline styles       |
| `useTokenTransformer`           | `boolean`                         | `false`          | Enable token-level hooks (`data-char` spans)   |
| `tokenizeMaxLineLength`         | `number`                          | `1000`           | Skip tokenization for lines longer than this   |
| `unsafeCSS`                     | `string`                          | —                | Raw CSS injected into shadow DOM               |

### BaseDiffOptions (extends BaseCodeOptions)

| Option                        | Type                                    | Default       | Description                                    |
|-------------------------------|-----------------------------------------|---------------|------------------------------------------------|
| `diffStyle`                   | `'unified' \| 'split'`                  | `'split'`     | Side-by-side or unified view                   |
| `diffIndicators`              | `'classic' \| 'bars' \| 'none'`         | `'bars'`      | `+/-` text vs colored bars vs nothing          |
| `disableBackground`           | `boolean`                                | `false`       | Remove colored backgrounds from diff lines     |
| `hunkSeparators`              | `'simple' \| 'metadata' \| 'line-info' \| 'line-info-basic'` | `'line-info'` | Separator style between hunks |
| `expandUnchanged`             | `boolean`                                | `false`       | Auto-expand all collapsed context              |
| `collapsedContextThreshold`   | `number`                                 | `1`           | Auto-expand context blocks ≤ this size         |
| `lineDiffType`                | `'word-alt' \| 'word' \| 'char' \| 'none'` | `'word-alt'` | Intra-line diff granularity                   |
| `maxLineDiffLength`           | `number`                                 | `1000`        | Skip intra-line diff for lines longer than this|
| `expansionLineCount`          | `number`                                 | `100`         | Lines to expand per click on collapsed context |
| `parseDiffOptions`            | `CreatePatchOptionsNonabortable`         | —             | Forwarded to jsdiff's `createTwoFilesPatch`    |

### Interaction Options

| Option                                  | Type       | Description                                              |
|-----------------------------------------|------------|----------------------------------------------------------|
| `lineHoverHighlight`                    | `'both' \| 'line' \| 'none'` | Hover highlighting mode                  |
| `enableLineSelection`                   | `boolean`  | Allow selecting line ranges                              |
| `enableGutterUtility`                   | `boolean`  | Show utility widget in gutter on hover                   |
| `enableTokenInteractionsOnWhitespace`   | `boolean`  | Fire token events for whitespace tokens                  |
| `onLineClick`                           | callback   | Fires on line click                                      |
| `onLineNumberClick`                     | callback   | Fires on line number click                               |
| `onLineEnter` / `onLineLeave`          | callback   | Fires on line hover                                      |
| `onTokenEnter` / `onTokenLeave`        | callback   | Fires on token hover                                     |
| `onLineSelected`                        | callback   | Fires when line selection completes                      |
| `onLineSelectionStart/Change/End`       | callbacks  | Selection lifecycle                                      |
| `onGutterUtilityClick`                  | callback   | Fires when gutter utility is clicked                     |
| `renderGutterUtility`                   | function   | Custom gutter utility element factory                    |
| `onHunkExpand`                          | callback   | Fires when a hunk is expanded                            |
| `renderAnnotation`                      | function   | Custom annotation element factory                        |
| `renderHeaderPrefix`                    | function   | Custom header prefix element                             |
| `renderHeaderMetadata`                  | function   | Custom header metadata element                           |
| `renderCustomHeader`                    | function   | Fully custom header element (replaces default)           |
| `onPostRender`                          | callback   | Fires after render completes                             |

## CSS Variables (on `:host` / `<diffs-container>`)

### Layout

| Variable                        | Default     | Description                              |
|---------------------------------|-------------|------------------------------------------|
| `--diffs-font-size`             | `13px`      | Code font size                           |
| `--diffs-line-height`           | `20px`      | Line height                              |
| `--diffs-font-family`           | (monospace) | Override code font                       |
| `--diffs-header-font-family`    | (sans-serif)| Override header font                     |
| `--diffs-font-features`         | —           | `font-feature-settings`                  |
| `--diffs-tab-size`              | —           | Tab width                                |
| `--diffs-gap-inline`            | —           | Horizontal gap                           |
| `--diffs-gap-block`             | —           | Vertical gap                             |
| `--diffs-gap-style`             | —           | Gap decoration style                     |

### Color Overrides

| Variable                                   | Description                        |
|--------------------------------------------|------------------------------------|
| `--diffs-bg-buffer-override`               | Virtualization buffer background   |
| `--diffs-bg-hover-override`                | Line hover background              |
| `--diffs-bg-context-override`              | Context line background            |
| `--diffs-bg-separator-override`            | Hunk separator background          |
| `--diffs-fg-number-override`               | Line number color                  |
| `--diffs-fg-number-addition-override`      | Addition line number color         |
| `--diffs-fg-number-deletion-override`      | Deletion line number color         |
| `--diffs-fg-conflict-marker-override`      | Merge conflict marker color        |
| `--diffs-deletion-color-override`          | Deletion semantic color            |
| `--diffs-addition-color-override`          | Addition semantic color            |
| `--diffs-modified-color-override`          | Modified semantic color            |
| `--diffs-bg-deletion-override`             | Deletion line background           |
| `--diffs-bg-deletion-number-override`      | Deletion line number background    |
| `--diffs-bg-deletion-hover-override`       | Deletion line hover background     |
| `--diffs-bg-deletion-emphasis-override`    | Intra-line deletion emphasis       |
| `--diffs-bg-addition-override`             | Addition line background           |
| `--diffs-bg-addition-number-override`      | Addition line number background    |
| `--diffs-bg-addition-hover-override`       | Addition line hover background     |
| `--diffs-bg-addition-emphasis-override`    | Intra-line addition emphasis       |
| `--diffs-selection-color-override`         | Selected line text color           |
| `--diffs-bg-selection-override`            | Selected line background           |
| `--diffs-bg-selection-number-override`     | Selected line number background    |
| `--diffs-bg-selection-background-override` | Selection region background        |
| `--diffs-bg-selection-number-background-override` | Selection number background |
| `--diffs-light-bg`                         | Light theme base background        |
| `--diffs-dark-bg`                          | Dark theme base background         |

### Theme Background Injection

The library computes backgrounds from the Shiki theme and injects them. Override with:
- `--diffs-light-bg` / `--diffs-dark-bg` for base backgrounds
- Or use `disableBackground: true` + your own CSS

## Key DOM Selectors (inside Shadow DOM)

| Selector                                | Element                              |
|-----------------------------------------|--------------------------------------|
| `pre[data-diff]`                        | Diff container `<pre>`               |
| `pre[data-file]`                        | File container `<pre>`               |
| `pre[data-diff-type="split"]`           | Split mode                           |
| `pre[data-diff-type="single"]`          | Unified mode                         |
| `pre[data-overflow="wrap"]`             | Wrapped lines                        |
| `[data-line]`                           | Each rendered line                   |
| `[data-line-type="addition"]`           | Addition lines                       |
| `[data-line-type="deletion"]`           | Deletion lines                       |
| `[data-line-type="context"]`            | Context lines                        |
| `[data-line-index]`                     | Line index attribute                 |
| `[data-alt-line]`                       | Alternate line number (context)      |
| `[data-code]`                           | Code column wrapper                  |
| `[data-unified]`                        | Unified code column                  |
| `[data-deletions]`                      | Deletions code column (split)        |
| `[data-additions]`                      | Additions code column (split)        |
| `[data-virtualizer-buffer]`             | Virtualization spacer                |
| `[data-container-size]`                 | Container size hint for sticky       |

### CSS Layers

The stylesheet uses `@layer base, theme, rendered, unsafe` ordering. The `unsafe` layer is where `unsafeCSS` content lands, giving it highest specificity within the shadow DOM.
