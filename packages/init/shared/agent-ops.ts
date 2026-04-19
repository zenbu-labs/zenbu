import type { SchemaRoot } from "./schema";

type Kernel = SchemaRoot;
export type HotAgent = Kernel["agents"][number];
export type ArchivedAgent = HotAgent & { archivedAt: number };

/**
 * Insert a freshly-created agent into `kernel.agents`, enforcing the
 * `hotAgentsCap` limit. If the array is already at/above the cap, the
 * oldest-by-`createdAt` hot agents are removed from the array and returned
 * as archived records so the caller can push them into the `archivedAgents`
 * collection after the update resolves (collections aren't draft-mutable).
 *
 * Must be called inside a `client.update((root) => ...)` callback; mutates
 * the draft kernel in place.
 *
 * Usage:
 *   let evicted: ArchivedAgent[] = [];
 *   await client.update((root) => {
 *     evicted = insertHotAgent(root.plugin.kernel, newAgent);
 *   });
 *   if (evicted.length) await concatArchived(client, evicted);
 */
type AgentConfig = Kernel["agentConfigs"][number];

/**
 * Snap a saved selection back to the available list for this kind. Returns
 * only the fields whose saved value is currently valid; unset (or
 * out-of-range) fields are omitted so the caller's spread doesn't
 * resurrect stale values. Used to seed a fresh agent instance from the
 * template's `defaultConfiguration`.
 */
export function validSelectionFromTemplate(
  template: AgentConfig,
): { model?: string; thinkingLevel?: string; mode?: string } {
  const dflt = template.defaultConfiguration ?? {};
  const out: { model?: string; thinkingLevel?: string; mode?: string } = {};
  if (
    dflt.model &&
    (!template.availableModels?.length ||
      template.availableModels.some((m) => m.value === dflt.model))
  ) {
    out.model = dflt.model;
  }
  if (
    dflt.thinkingLevel &&
    (!template.availableThinkingLevels?.length ||
      template.availableThinkingLevels.some(
        (t) => t.value === dflt.thinkingLevel,
      ))
  ) {
    out.thinkingLevel = dflt.thinkingLevel;
  }
  if (
    dflt.mode &&
    (!template.availableModes?.length ||
      template.availableModes.some((m) => m.value === dflt.mode))
  ) {
    out.mode = dflt.mode;
  }
  return out;
}

export function insertHotAgent(
  kernel: Kernel,
  agent: HotAgent,
): ArchivedAgent[] {
  const evicted: ArchivedAgent[] = [];
  while (kernel.agents.length >= kernel.hotAgentsCap) {
    let oldestIdx = 0;
    for (let i = 1; i < kernel.agents.length; i++) {
      if (kernel.agents[i].createdAt < kernel.agents[oldestIdx].createdAt) {
        oldestIdx = i;
      }
    }
    const e = kernel.agents[oldestIdx];
    evicted.push({ ...e, archivedAt: Date.now() });
    kernel.agents = [
      ...kernel.agents.slice(0, oldestIdx),
      ...kernel.agents.slice(oldestIdx + 1),
    ];
  }
  kernel.agents = [...kernel.agents, agent];
  return evicted;
}
