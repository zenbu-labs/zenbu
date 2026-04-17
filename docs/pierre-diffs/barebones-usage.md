# Barebones Usage

## Simplest Vanilla (no React, no workers, no virtualization)

```ts
import { FileDiff, parseDiffFromFile, DIFFS_TAG_NAME } from '@pierre/diffs';

// 1. Parse diff from two file versions
const diff = parseDiffFromFile(
  { name: 'file.ts', contents: 'const a = 1;\n' },
  { name: 'file.ts', contents: 'const a = 2;\nconst b = 3;\n' }
);

// 2. Create a container (custom element with shadow DOM)
const container = document.createElement(DIFFS_TAG_NAME);
document.body.appendChild(container);

// 3. Create instance and render
const instance = new FileDiff({ diffStyle: 'unified' });
instance.render({ fileDiff: diff, fileContainer: container });
```

That's it. The `FileDiff` class handles:
- Creating the shared Shiki highlighter (lazily, first render)
- Tokenizing both file versions
- Computing intra-line diffs
- Building HAST → HTML
- Inserting into shadow DOM
- Applying default theme

## Simplest React

```tsx
import { FileDiff } from '@pierre/diffs/react';

function MyDiff() {
  return (
    <FileDiff
      oldFile={{ name: 'file.ts', contents: 'const a = 1;\n' }}
      newFile={{ name: 'file.ts', contents: 'const a = 2;\nconst b = 3;\n' }}
      diffStyle="unified"
    />
  );
}
```

## From a Patch String

```ts
import { FileDiff, parsePatchFiles, DIFFS_TAG_NAME } from '@pierre/diffs';

const patchString = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1 +1,2 @@
-const a = 1;
+const a = 2;
+const b = 3;`;

const patches = parsePatchFiles(patchString);
const container = document.createElement(DIFFS_TAG_NAME);
document.body.appendChild(container);

for (const patch of patches) {
  for (const fileDiff of patch.files) {
    const instance = new FileDiff({ diffStyle: 'split' });
    instance.render({ fileDiff, fileContainer: container });
  }
}
```

## With Worker Pool (recommended for production)

```ts
import { VirtualizedFileDiff, Virtualizer, parseDiffFromFile, DIFFS_TAG_NAME } from '@pierre/diffs';
import { WorkerPoolManager } from '@pierre/diffs/worker';

// Create worker pool
const pool = new WorkerPoolManager(
  { poolSize: 4, workerFactory: () => new Worker(new URL('@pierre/diffs/worker/worker.js', import.meta.url)) },
  { theme: { dark: 'pierre-dark', light: 'pierre-light' }, langs: ['typescript'] }
);

// Create virtualizer for scroll-based windowing
const virtualizer = new Virtualizer();
virtualizer.setup(document);

// Parse and render
const diff = parseDiffFromFile(
  { name: 'file.ts', contents: oldContent, cacheKey: 'old-v1' },
  { name: 'file.ts', contents: newContent, cacheKey: 'new-v1' }
);

const container = document.createElement(DIFFS_TAG_NAME);
document.body.appendChild(container);

const instance = new VirtualizedFileDiff(
  { diffStyle: 'split', theme: { dark: 'pierre-dark', light: 'pierre-light' } },
  virtualizer,
  undefined,
  pool
);
instance.render({ fileDiff: diff, fileContainer: container });
```

## Just the Primitives (no components)

If you want maximum control:

```ts
import {
  parseDiffFromFile,
  getSharedHighlighter,
  renderDiffWithHighlighter,
} from '@pierre/diffs';
import { toHtml } from 'hast-util-to-html';

// 1. Parse
const diff = parseDiffFromFile(oldFile, newFile);

// 2. Get highlighter
const highlighter = await getSharedHighlighter({
  themes: ['pierre-dark', 'pierre-light'],
  langs: ['typescript'],
});

// 3. Render to HAST
const { code, themeStyles } = renderDiffWithHighlighter(
  diff,
  highlighter,
  { theme: { dark: 'pierre-dark', light: 'pierre-light' }, useTokenTransformer: false, tokenizeMaxLineLength: 1000, lineDiffType: 'word-alt', maxLineDiffLength: 1000 }
);

// 4. You now have HAST arrays:
//    code.deletionLines: ElementContent[]
//    code.additionLines: ElementContent[]
//    themeStyles: string (CSS for syntax colors)
//
// Convert individual lines to HTML:
const htmlLine = toHtml(code.additionLines[0]);
```

This gives you raw HAST nodes — you can transform, filter, or render them however you want without using the component layer at all.
