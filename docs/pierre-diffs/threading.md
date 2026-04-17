# Threading & Workers

## Architecture

`@pierre/diffs` has first-class Web Worker support via `WorkerPoolManager`. The design splits work:

- **Workers**: Shiki `codeToHast` (tokenization + HAST generation) — the dominant cost
- **Main thread**: DOM assembly, interaction, layout

## WorkerPoolManager

```ts
import { WorkerPoolManager } from '@pierre/diffs/worker';

const manager = new WorkerPoolManager(
  {
    poolSize: 8,                    // number of workers (default 8)
    workerFactory: () => new Worker(workerURL),
    totalASTLRUCacheSize: 100,      // LRU cache size for highlighted ASTs
  },
  {
    theme: { dark: 'pierre-dark', light: 'pierre-light' },
    langs: ['typescript', 'tsx'],   // pre-resolve these languages
    preferredHighlighter: 'shiki-js',
    useTokenTransformer: false,
    lineDiffType: 'word-alt',
    maxLineDiffLength: 1000,
    tokenizeMaxLineLength: 1000,
  }
);
```

## Worker Script

The worker entry (`@pierre/diffs/worker/worker.js` or `worker-portable.js`) creates its own `createHighlighterCore` from `shiki/core`. It handles 4 message types:

1. `initialize` — create highlighter, attach resolved themes/languages
2. `set-render-options` — update theme/options without re-creating
3. `file` — `renderFileWithHighlighter` in the worker
4. `diff` — `renderDiffWithHighlighter` in the worker

## Plain-First Strategy

The key performance pattern: render a plain (unhighlighted) AST instantly on the main thread, then replace it when the worker completes highlighting:

```ts
// Immediate: plain text AST on main thread
const plainAST = manager.getPlainDiffAST(diff, startLine, totalLines);
renderToDOM(plainAST);

// Async: highlighted AST from worker (replaces plain on callback)
manager.highlightDiffAST(instanceRef, diff);
// instanceRef.onHighlightSuccess will fire when worker completes
```

This is what `VirtualizedFileDiff` does internally.

## Language Resolution

Workers cannot dynamically `import()` language grammars. Languages must be resolved on the main thread first:

```ts
import { resolveLanguage } from '@pierre/diffs';

const resolved = await resolveLanguage('typescript');
// resolved grammars are sent to workers via the initialize/render messages
```

The `WorkerPoolManager` handles this automatically — it tracks which languages each worker has loaded and sends missing ones with render requests.

## React Integration

```tsx
import { WorkerPoolContextProvider, useWorkerPool } from '@pierre/diffs/react';

<WorkerPoolContextProvider
  workerFactory={() => new Worker(workerURL)}
  poolSize={8}
  theme={themes}
  langs={['typescript']}
>
  <FileDiff ... />
</WorkerPoolContextProvider>
```

Components inside the provider automatically use the worker pool. Set `disableWorkerPool` on individual components to opt out.

## Running Everything in a Different Thread

To move ALL diff computation off the main thread:

1. Use `WorkerPoolManager` for all rendering
2. Call `getPlainDiffAST()` or `getPlainFileAST()` for instant placeholder (runs on main thread but is cheap — no Shiki tokenization)
3. All Shiki tokenization + HAST generation happens in workers
4. Main thread only does DOM insertion from pre-built HTML strings

What CANNOT be moved to workers:
- DOM manipulation (must be main thread)
- InteractionManager event handling
- Layout measurements for virtualization
- Language grammar resolution (dynamic imports)
