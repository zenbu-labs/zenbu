import type { SimulationContext } from "./engine.ts"
import { readLiveConfig } from "./engine.ts"
import { streamChunksLive, sleep } from "./streaming.ts"

export async function emitThinking(
  ctx: SimulationContext,
  content: string,
): Promise<void> {
  const { config } = await readLiveConfig(ctx.db)
  await sleep(config.thinkingDelayMs, ctx.signal)
  await streamChunksLive(ctx, content, "agent_thought_chunk")
}
