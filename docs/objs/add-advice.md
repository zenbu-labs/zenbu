# Add Advice to a Function

## What You're Doing

Intercepting, wrapping, or replacing a function at runtime using the advice system—inspired by Emacs `defadvice`. This works for both Node.js (main process) and browser (renderer) code.

## Background

### What Is Advice?

A Babel transform (applied by both a Node loader and a Vite plugin) rewrites every top-level function in the codebase. For each function `foo` in a file, the transform inserts:

- `__zenbu_def(moduleId, "foo", originalFoo)` — registers the implementation
- `__zenbu_ref(moduleId, "foo")` — returns a stable wrapper that dispatches through an advice chain

The wrapper is the function that actually gets called. It checks for any registered advice (before, after, around) and runs the chain. This means you can modify any function's behavior without editing its source file.

### moduleId Format

The `moduleId` is the file's path relative to the project root, with forward slashes:

```
packages/init/src/main/services/agent.ts     → "packages/init/src/main/services/agent.ts"
packages/init/src/renderer/views/chat/App.tsx → "packages/init/src/renderer/views/chat/App.tsx"
```

The root is `process.cwd()` for the Node loader and `config.root` for the Vite plugin. Since the shell sets `process.chdir(projectRoot)` at startup, both use the monorepo root.

### What Gets Transformed

Only **top-level** declarations in files under the project root (excluding `node_modules` and `packages/advice/`):
- `function foo() { ... }` — named function declarations
- `export default function Foo() { ... }` — default exports
- `const foo = () => { ... }` — top-level const arrow/function expressions
- `const foo = function() { ... }` — top-level const function expressions

**Not transformed:** nested functions, class methods, functions in `node_modules`.

### Advice Types

| Type | When It Runs | Signature |
|------|-------------|-----------|
| `before` | Before the original, receives args | `(arg1, arg2, ...) => void` |
| `after` | After the original, can replace return value | `(result, arg1, arg2, ...) => newResult \| undefined` |
| `around` | Wraps the original, controls execution | `(next, arg1, arg2, ...) => result` |

**Execution order:** around(outer) → before → original → after → around(outer return)

### Current Status

The advice transform is active on all code paths (Node and Vite), but there are no `advise()` or `replace()` calls in production code yet—only in tests. The infrastructure is fully functional.

## Steps

### 1. Identify the Target Function

You need two things:
- **`moduleId`**: The file path relative to the project root
- **`name`**: The function's binding name (e.g. `"handleMessage"`, `"App"`, or `"default"` for anonymous default exports)

If unsure, inspect the transformed source. In browser devtools, the source map points back to the original, but the actual code contains `__zenbu_def("moduleId", "name", ...)` calls that reveal the exact values.

### 2. Import the Advice Runtime

```typescript
import { advise, replace } from "@zenbu/advice/runtime"
```

### 3. Replace a Function

Swap the implementation entirely. All existing callers (using the `__zenbu_ref` wrapper) will see the new function on their next call:

```typescript
replace(
  "packages/init/src/main/services/agent.ts",
  "parseStartCommand",
  (startCommand: string) => {
    // custom parsing logic
    const [command, ...args] = startCommand.split(" ")
    return { command, args }
  }
)
```

### 4. Add Before Advice

Run code before the function executes:

```typescript
const removeAdvice = advise(
  "packages/init/src/renderer/views/chat/App.tsx",
  "ChatContent",
  "before",
  (...args) => {
    console.log("ChatContent rendering with args:", args)
  }
)

// Later, to remove:
removeAdvice()
```

`advise()` returns a removal function. Call it to detach the advice.

### 5. Add After Advice

Run code after the function, optionally replacing the return value:

```typescript
advise(
  "packages/init/src/main/routers/main-router.ts",
  "someHelper",
  "after",
  (result, ...originalArgs) => {
    console.log("someHelper returned:", result)
    // Return undefined to keep the original result
    // Return a value to replace it
    return modifiedResult
  }
)
```

After advice runs in **reverse** registration order. If it returns `undefined`, the previous result is kept.

### 6. Add Around Advice

Full control over whether and how the original runs:

```typescript
advise(
  "packages/init/src/main/services/agent.ts",
  "parseStartCommand",
  "around",
  (next, startCommand: string) => {
    console.log("before parseStartCommand")
    const result = next(startCommand)    // call the original (or don't)
    console.log("after parseStartCommand:", result)
    return result
  }
)
```

`next` is the original function (or the next inner around advice). You can:
- Call `next(...)` normally
- Call `next(...)` with modified args
- Skip `next(...)` entirely and return your own value
- Call `next(...)` multiple times

### Where to Put Advice Code

**In a service (Node/main process):**
```typescript
export class MyAdviceService extends Service {
  static key = "my-advice"
  static deps = {}

  evaluate() {
    this.effect("advice", () => {
      const remove = advise("some/module.ts", "someFunction", "around", (next, ...args) => {
        return next(...args)
      })
      return () => remove()
    })
  }
}
```

Using `effect()` ensures the advice is removed on re-evaluation/shutdown.

**In frontend code:** Import and call `advise()` or `replace()` at module scope or in a React effect. Since the advice runtime is a singleton per JS realm, the same `moduleId + name` is shared across all code in that realm.

## Discovering Available Functions

There is no built-in registry of advisable functions. Current approaches:
- Read the source file and look for top-level function declarations
- Inspect transformed output in browser devtools (search for `__zenbu_def`)
- The `moduleId` is always the repo-relative path of the file

## Checklist

- [ ] Target file is under project root (not `node_modules`)
- [ ] Target function is a top-level declaration (not nested, not a class method)
- [ ] `moduleId` matches the repo-relative path exactly
- [ ] `name` matches the binding name in source
- [ ] `advise()` return value (remover) is stored for cleanup
- [ ] If in a service, advice is registered inside `effect()` with cleanup
