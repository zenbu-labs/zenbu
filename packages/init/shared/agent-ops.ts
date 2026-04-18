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
