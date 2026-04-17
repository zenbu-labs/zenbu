import type { FunctionEntry, AdviceEntry } from "./registry.js"

export function applyAdviceChain(entry: FunctionEntry, args: any[], thisArg?: any): any {
  const befores: AdviceEntry[] = []
  const afters: AdviceEntry[] = []
  const arounds: AdviceEntry[] = []

  for (const a of entry.advice) {
    switch (a.type) {
      case "before": befores.push(a); break
      case "after": afters.push(a); break
      case "around": arounds.push(a); break
    }
  }

  const coreWithBeforesAfters = (...callArgs: any[]) => {
    for (const b of befores) {
      b.fn.apply(thisArg, callArgs)
    }
    let result = (entry.replacement ?? entry.impl).apply(thisArg, callArgs)
    for (let i = afters.length - 1; i >= 0; i--) {
      const afterResult = afters[i].fn.call(thisArg, result, ...callArgs)
      if (afterResult !== undefined) result = afterResult
    }
    return result
  }

  let composed = coreWithBeforesAfters
  for (let i = arounds.length - 1; i >= 0; i--) {
    const aroundFn = arounds[i].fn
    const next = composed
    composed = (...callArgs: any[]) => aroundFn.call(thisArg, next, ...callArgs)
  }

  return composed(...args)
}
