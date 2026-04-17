export type AdviceType = "before" | "after" | "around"

export interface AdviceEntry {
  type: AdviceType
  fn: Function
}

export interface FunctionEntry {
  impl: Function
  replacement: Function | null
  advice: AdviceEntry[]
  wrapper?: Function
}

const registry = new Map<string, Map<string, FunctionEntry>>()

function key(moduleId: string, name: string): string {
  return `${moduleId}:${name}`
}

export function getEntry(moduleId: string, name: string): FunctionEntry | undefined {
  return registry.get(moduleId)?.get(name)
}

export function getOrCreateEntry(moduleId: string, name: string): FunctionEntry {
  let moduleMap = registry.get(moduleId)
  if (!moduleMap) {
    moduleMap = new Map()
    registry.set(moduleId, moduleMap)
  }
  let entry = moduleMap.get(name)
  if (!entry) {
    entry = { impl: () => { throw new Error(`${moduleId}:${name} not yet defined`) }, replacement: null, advice: [] }
    moduleMap.set(name, entry)
  }
  return entry
}

export function setImpl(moduleId: string, name: string, fn: Function): void {
  const entry = getOrCreateEntry(moduleId, name)
  entry.impl = fn
  entry.wrapper = undefined
}

export function setReplacement(moduleId: string, name: string, fn: Function): void {
  const entry = getOrCreateEntry(moduleId, name)
  entry.replacement = fn
}

export function clearReplacement(moduleId: string, name: string): void {
  const entry = getEntry(moduleId, name)
  if (entry) entry.replacement = null
}

export function addAdvice(moduleId: string, name: string, type: AdviceType, fn: Function): () => void {
  const entry = getOrCreateEntry(moduleId, name)
  const adviceEntry: AdviceEntry = { type, fn }
  entry.advice.push(adviceEntry)
  return () => {
    const idx = entry.advice.indexOf(adviceEntry)
    if (idx >= 0) entry.advice.splice(idx, 1)
  }
}

export function clearModule(moduleId: string): void {
  registry.delete(moduleId)
}

export { registry }
