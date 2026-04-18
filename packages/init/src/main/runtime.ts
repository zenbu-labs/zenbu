export type CleanupReason = "reload" | "shutdown"
type EffectCleanup = ((reason: CleanupReason) => void | Promise<void>) | void
type EffectSetup = () => EffectCleanup

interface HotContext {
  accept(): void
  dispose(cb: () => void | Promise<void>): void
  prune?(cb: () => void | Promise<void>): void
}

interface ServiceSlot {
  error: unknown | null
  instance: Service | null
  ServiceClass: typeof Service
  status: "blocked" | "evaluating" | "ready" | "failed"
}

console.log("[kernel] runtime edit check")

type DepRef = typeof Service | string
type OptionalDep = { __optional: true; ref: DepRef }
type DepEntry = DepRef | OptionalDep

export function optional(ref: DepRef): OptionalDep {
  return { __optional: true, ref }
}

function resolveDep(entry: DepEntry): { key: string; optional: boolean } {
  if (typeof entry === "string") return { key: entry, optional: false }
  if (typeof entry === "object" && entry !== null && "__optional" in entry) {
    const ref = entry.ref
    return { key: typeof ref === "string" ? ref : ref.key, optional: true }
  }
  return { key: (entry as typeof Service).key, optional: false }
}


export abstract class Service {
  static key: string
  static deps: Record<string, DepEntry>

  ctx: any

  private __effectCleanups: Map<string, (reason: CleanupReason) => void | Promise<void>> = new Map()

  abstract evaluate(): void | Promise<void>

  protected effect(key: string, setup: EffectSetup): void {
    const existing = this.__effectCleanups.get(key)
    if (existing) {
      try { existing("reload") } catch (e) { console.error(`[hot] effect cleanup "${key}" failed:`, e) }
    }
    const cleanup = setup()
    if (cleanup) {
      this.__effectCleanups.set(key, cleanup)
    } else {
      this.__effectCleanups.delete(key)
    }
  }

  /** @internal */
  async __cleanupAllEffects(reason: CleanupReason = "shutdown") {
    for (const [key, cleanup] of this.__effectCleanups) {
      try {
        await cleanup(reason)
      } catch (e) {
        console.error(`[hot] effect cleanup "${key}" failed:`, e)
      }
    }
    this.__effectCleanups.clear()
  }
}

const SERVICE_BASE_METHODS = new Set(Object.getOwnPropertyNames(Service.prototype))

export class ServiceRuntime {
  private definitions = new Map<string, typeof Service>()
  private dependentsIndex = new Map<string, Set<string>>()
  private dirtyKeys = new Set<string>()
  private drainError: unknown = null
  private draining: Promise<void> | null = null
  private registrationTokens = new Map<string, symbol>()
  private slots = new Map<string, ServiceSlot>()
  private onReconciledCallbacks: Array<(changedKeys: string[]) => void> = []

  register(ServiceClass: typeof Service, hot?: HotContext | null): void {
    const key = ServiceClass.key
    if (!key) throw new Error("Service must have a static key property")

    this.definitions.set(key, ServiceClass)
    const slot = this.slots.get(key)
    if (slot) {
      slot.ServiceClass = ServiceClass
    } else {
      this.slots.set(key, {
        error: null,
        instance: null,
        ServiceClass,
        status: "blocked",
      })
    }
    this.rebuildDependentsIndex()

    hot?.accept()
    const token = Symbol(key)
    this.registrationTokens.set(key, token)
    hot?.prune?.(() => this.unregister(key, token))

    void this.scheduleReconcile([key])
  }

  async whenIdle(): Promise<void> {
    while (this.draining) {
      await this.draining
    }
    if (this.drainError) {
      const error = this.drainError
      this.drainError = null
      throw error
    }
  }

  async reloadAll(): Promise<void> {
    const keys = [...this.slots.keys()]
    if (keys.length === 0) return
    await this.scheduleReconcile(keys)
    await this.whenIdle()
  }

  async shutdown(): Promise<void> {
    try {
      await this.whenIdle()
    } catch (error) {
      console.error("[hot] runtime idle wait failed during shutdown:", error)
    }

    const keys = [...this.slots.keys()].reverse()
    for (const key of keys) {
      await this.teardownService(key, { removeSlot: true })
    }
    this.definitions.clear()
    this.dependentsIndex.clear()
    this.dirtyKeys.clear()
    this.registrationTokens.clear()
  }

  get<T extends Service>(ref: { key: string }): T {
    const slot = this.slots.get(ref.key)
    if (!slot || slot.status !== "ready" || !slot.instance) {
      throw new Error(`Service "${ref.key}" not ready. Is it registered and evaluated?`)
    }
    return slot.instance as T
  }

  buildRouter(): Record<string, Record<string, (...args: any[]) => any>> {
    const router: Record<string, Record<string, (...args: any[]) => any>> = {}

    for (const [key, slot] of this.slots) {
      if (slot.status !== "ready" || !slot.instance) continue
      const proto = Object.getPrototypeOf(slot.instance)
      const methods: Record<string, (...args: any[]) => any> = {}

      for (const name of Object.getOwnPropertyNames(proto)) {
        if (SERVICE_BASE_METHODS.has(name)) continue
        if (name.startsWith("_")) continue
        const desc = Object.getOwnPropertyDescriptor(proto, name)
        if (!desc || typeof desc.value !== "function") continue
        const instance = slot.instance as any
        methods[name] = (...args: any[]) => instance[name](...args)
      }

      if (Object.keys(methods).length > 0) router[key] = methods
    }
    return router
  }

  onReconciled(cb: (changedKeys: string[]) => void): () => void {
    this.onReconciledCallbacks.push(cb)
    return () => {
      const idx = this.onReconciledCallbacks.indexOf(cb)
      if (idx >= 0) this.onReconciledCallbacks.splice(idx, 1)
    }
  }

  private injectCtx(instance: Service, ServiceClass: typeof Service): void {
    const deps = (ServiceClass as any).deps as Record<string, DepEntry> | undefined ?? {}
    const ctx: Record<string, Service | undefined> = {}
    for (const [name, entry] of Object.entries(deps)) {
      const { key, optional: isOptional } = resolveDep(entry)
      const slot = this.slots.get(key)
      if (!slot || slot.status !== "ready" || !slot.instance) {
        if (isOptional) {
          ctx[name] = undefined
          continue
        }
        throw new Error(`Dependency "${key}" not ready for "${ServiceClass.key}"`)
      }
      ctx[name] = slot.instance
    }
    ;(instance as any).ctx = ctx
  }

  private rebuildDependentsIndex(): void {
    const next = new Map<string, Set<string>>()
    for (const [key, ServiceClass] of this.definitions) {
      const deps = (ServiceClass as any).deps as Record<string, DepEntry> | undefined ?? {}
      for (const entry of Object.values(deps)) {
        const { key: depKey } = resolveDep(entry)
        const dependents = next.get(depKey) ?? new Set<string>()
        dependents.add(key)
        next.set(depKey, dependents)
      }
    }
    this.dependentsIndex = next
  }

  private getAffectedKeys(changedKeys: Iterable<string>): string[] {
    const affected = new Set<string>()
    const visit = (key: string) => {
      if (affected.has(key)) return
      affected.add(key)
      for (const dependent of this.dependentsIndex.get(key) ?? []) {
        visit(dependent)
      }
    }
    for (const key of changedKeys) {
      visit(key)
    }
    return [...affected].filter(key => this.definitions.has(key))
  }

  private listMissingDeps(ServiceClass: typeof Service): string[] {
    const deps = (ServiceClass as any).deps as Record<string, DepEntry> | undefined ?? {}
    const missing: string[] = []
    for (const entry of Object.values(deps)) {
      const { key, optional: isOptional } = resolveDep(entry)
      if (isOptional) continue
      const slot = this.slots.get(key)
      if (!slot || slot.status !== "ready" || !slot.instance) {
        missing.push(key)
      }
    }
    return missing
  }

  private ensureSlot(key: string, ServiceClass: typeof Service): ServiceSlot {
    const existing = this.slots.get(key)
    if (existing) return existing
    const slot: ServiceSlot = {
      error: null,
      instance: null,
      ServiceClass,
      status: "blocked",
    }
    this.slots.set(key, slot)
    return slot
  }

  private async teardownService(key: string, options: { removeSlot?: boolean; reason?: CleanupReason } = {}): Promise<void> {
    const slot = this.slots.get(key)
    if (!slot) return

    const instance = slot.instance
    slot.instance = null
    slot.status = "blocked"
    slot.error = null

    if (instance) {
      await instance.__cleanupAllEffects(options.reason ?? "shutdown")
    }

    if (options.removeSlot) {
      this.slots.delete(key)
    }
  }

  private async unregister(key: string, token: symbol): Promise<void> {
    if (this.registrationTokens.get(key) !== token) return

    this.registrationTokens.delete(key)
    this.definitions.delete(key)
    await this.teardownService(key, { removeSlot: true })
    this.rebuildDependentsIndex()
    await this.scheduleReconcile([key])
  }

  private async scheduleReconcile(keys: Iterable<string>): Promise<void> {
    for (const key of keys) {
      this.dirtyKeys.add(key)
    }

    if (this.draining) {
      return this.draining
    }

    this.draining = (async () => {
      try {
        while (this.dirtyKeys.size > 0) {
          const batch = [...this.dirtyKeys]
          this.dirtyKeys.clear()
          await this.reconcileBatch(batch)
        }
      } catch (error) {
        this.drainError = error
        console.error("[hot] runtime reconcile failed:", error)
      } finally {
        this.draining = null
        if (this.dirtyKeys.size > 0) {
          void this.scheduleReconcile([])
        }
      }
    })()

    return this.draining
  }

  private async reconcileBatch(changedKeys: readonly string[]): Promise<void> {
    const affectedKeys = this.getAffectedKeys(changedKeys)
    if (affectedKeys.length === 0) return

    const affected = new Map<string, typeof Service>()
    for (const key of affectedKeys) {
      const ServiceClass = this.definitions.get(key)
      if (ServiceClass) {
        affected.set(key, ServiceClass)
      }
    }

    const levels = this.topologicalLevels(affected)

    // Phase 1: clean up all affected in REVERSE topo order (dependents before dependencies)
    for (const level of [...levels].reverse()) {
      await Promise.all(level.map(async (key) => {
        const slot = this.slots.get(key)
        if (slot?.instance) {
          await slot.instance.__cleanupAllEffects("reload")
        }
      }))
    }

    // Phase 2: re-evaluate in forward topo order (dependencies before dependents)
    for (const level of levels) {
      await Promise.all(level.map(key => this.reconcileKey(key)))
    }

    if (affectedKeys.length > 0) {
      for (const cb of this.onReconciledCallbacks) {
        try { cb(affectedKeys) } catch (e) { console.error("[hot] onReconciled callback failed:", e) }
      }
    }
  }

  private async reconcileKey(key: string): Promise<void> {
    const ServiceClass = this.definitions.get(key)
    if (!ServiceClass) return

    const slot = this.ensureSlot(key, ServiceClass)
    slot.ServiceClass = ServiceClass

    const missingDeps = this.listMissingDeps(ServiceClass)
    if (missingDeps.length > 0) {
      const shouldLog = slot.instance !== null || slot.status !== "blocked"
      await this.teardownService(key, { reason: "reload" })
      if (shouldLog) {
        console.log(`[hot] ${key} waiting on: ${missingDeps.join(", ")}`)
      }
      return
    }

    const wasReady = slot.status === "ready" && slot.instance !== null
    let instance = slot.instance
    if (!instance) {
      instance = new (ServiceClass as any)() as Service
      slot.instance = instance
    } else {
      Object.setPrototypeOf(instance, ServiceClass.prototype)
    }

    slot.status = "evaluating"
    slot.error = null

    try {
      await instance.__cleanupAllEffects("reload")
      this.injectCtx(instance, ServiceClass)
      await instance.evaluate()
      slot.status = "ready"
      console.log(`[hot] ${key} ${wasReady ? "re-evaluated" : "started"}`)
    } catch (e) {
      slot.status = "failed"
      slot.error = e
      console.error(`[hot] ${key} failed to evaluate:`, e)
    }
  }

  private topologicalLevels(services: Map<string, typeof Service>): string[][] {
    const keys = new Set(services.keys())
    const inDegree = new Map<string, number>()
    const dependents = new Map<string, string[]>()

    for (const key of keys) {
      inDegree.set(key, 0)
      dependents.set(key, [])
    }

    for (const [key, ServiceClass] of services) {
      const deps = (ServiceClass as any).deps as Record<string, DepEntry> | undefined ?? {}
      let degree = 0
      for (const entry of Object.values(deps)) {
        const { key: depKey, optional: isOptional } = resolveDep(entry)
        if (keys.has(depKey)) {
          degree++
          dependents.get(depKey)!.push(key)
        } else if (isOptional) {
          continue
        }
      }
      inDegree.set(key, degree)
    }

    const levels: string[][] = []
    let queue = [...keys].filter(k => inDegree.get(k) === 0)

    while (queue.length > 0) {
      levels.push(queue)
      const next: string[] = []
      for (const key of queue) {
        for (const dep of dependents.get(key)!) {
          const d = inDegree.get(dep)! - 1
          inDegree.set(dep, d)
          if (d === 0) next.push(dep)
        }
      }
      queue = next
    }

    const resolved = levels.flat()
    if (resolved.length !== keys.size) {
      const missing = [...keys].filter(k => !resolved.includes(k))
      throw new Error(`Circular dependency detected involving: ${missing.join(", ")}`)
    }

    return levels
  }
}

export const runtime: ServiceRuntime = (globalThis as any).__zenbu_service_runtime__ ??= new ServiceRuntime()
