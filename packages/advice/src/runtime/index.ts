import { registry, setImpl, getOrCreateEntry, addAdvice, getEntry, setReplacement, clearReplacement, type AdviceType } from "./registry.js"
import { applyAdviceChain } from "./chain.js"

export type { AdviceType } from "./registry.js"

;(globalThis as any).__zenbu_advice_registry__ = registry

/**
 * Register a function implementation. Called by transformed code.
 * Sets entry.impl only -- does not touch entry.replacement, so plugin
 * overrides survive HMR re-evaluation of the original module.
 */
export function __def(moduleId: string, name: string, fn: Function): void {
  setImpl(moduleId, name, fn)
}

/**
 * Returns a stable wrapper function that dispatches through the advice chain.
 * Returns the same function reference for the same moduleId+name across calls,
 * which is critical for React Refresh component identity.
 */
export function __ref(moduleId: string, name: string): Function {
  const entry = getOrCreateEntry(moduleId, name)

  if (!entry.wrapper) {
    entry.wrapper = function wrapper(this: any, ...args: any[]) {
      return applyAdviceChain(entry, args, this)
    }
  }

  return entry.wrapper
}

/**
 * Override a function with a plugin-provided replacement.
 * Unlike __def(), this sets entry.replacement which takes precedence
 * over entry.impl and is NOT cleared by subsequent __def() calls.
 * This allows a prelude script to call replace() before modules load,
 * and have the replacement survive module evaluation.
 */
export function replace(moduleId: string, name: string, newFn: Function): void {
  setReplacement(moduleId, name, newFn)
}

/**
 * Remove a previously set replacement, restoring the original implementation.
 */
export function unreplace(moduleId: string, name: string): void {
  clearReplacement(moduleId, name)
}

/**
 * Add before/after/around advice to a function.
 * Returns a removal function.
 */
export function advise(
  moduleId: string,
  name: string,
  type: AdviceType,
  fn: Function
): () => void {
  return addAdvice(moduleId, name, type, fn)
}
