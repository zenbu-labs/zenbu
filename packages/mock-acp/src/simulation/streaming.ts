import type { ClientProxy } from "@zenbu/kyju"
import type { StreamingConfig, FuzzConfig, MockAgentSchema } from "../../shared/schema.ts"
import type { SimulationContext } from "./engine.ts"
import { readLiveConfig } from "./engine.ts"

export type StreamChunk = {
  text: string
  delayMs: number
}

/**
 * Stream text content chunk by chunk, reading config from DB on each chunk
 * so slider changes take effect immediately.
 */
export async function streamChunksLive(
  ctx: SimulationContext,
  content: string,
  updateType: "agent_message_chunk" | "agent_thought_chunk",
): Promise<void> {
  let pos = 0

  while (pos < content.length) {
    ctx.signal.throwIfAborted()

    // Read config fresh from DB each chunk
    const { config, fuzz } = await readLiveConfig(ctx.db)

    const jitter = 1 + (Math.random() - 0.5) * 2 * config.interChunkJitter
    const size = Math.max(1, Math.round(config.chunkSize * jitter))
    let chunk = content.slice(pos, pos + size)
    pos += size

    const baseDelay = (chunk.length / config.charsPerSecond) * 1000
    let delayMs = Math.max(1, Math.round(baseDelay))

    if (fuzz.enabled && fuzz.randomDelayRange[0] < fuzz.randomDelayRange[1]) {
      const [min, max] = fuzz.randomDelayRange
      delayMs += Math.round(min + Math.random() * (max - min))
    }

    if (fuzz.enabled && Math.random() < fuzz.dropChunkProbability) {
      continue
    }

    if (fuzz.enabled && Math.random() < fuzz.partialChunkProbability) {
      chunk = chunk.slice(0, Math.max(1, Math.floor(chunk.length * Math.random())))
    }

    await sleep(delayMs, ctx.signal)

    ctx.conn.sessionUpdate({
      sessionId: ctx.sessionId,
      update: {
        sessionUpdate: updateType,
        content: { type: "text", text: chunk },
      },
    })
  }
}

/** Pre-compute all chunks (used for non-live cases like tool call output) */
export function chunkText(
  text: string,
  config: StreamingConfig,
  fuzz: FuzzConfig,
): StreamChunk[] {
  const chunks: StreamChunk[] = []
  let pos = 0

  while (pos < text.length) {
    const jitter = 1 + (Math.random() - 0.5) * 2 * config.interChunkJitter
    const size = Math.max(1, Math.round(config.chunkSize * jitter))
    const chunk = text.slice(pos, pos + size)
    pos += size

    const baseDelay = (chunk.length / config.charsPerSecond) * 1000
    let delayMs = Math.max(1, Math.round(baseDelay))

    if (fuzz.enabled && fuzz.randomDelayRange[0] < fuzz.randomDelayRange[1]) {
      const [min, max] = fuzz.randomDelayRange
      delayMs += Math.round(min + Math.random() * (max - min))
    }

    if (fuzz.enabled && Math.random() < fuzz.dropChunkProbability) {
      continue
    }

    if (fuzz.enabled && Math.random() < fuzz.partialChunkProbability) {
      const cutoff = Math.max(1, Math.floor(chunk.length * Math.random()))
      chunks.push({ text: chunk.slice(0, cutoff), delayMs })
      continue
    }

    chunks.push({ text: chunk, delayMs })
  }

  return chunks
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"))
      return
    }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer)
        reject(new DOMException("Aborted", "AbortError"))
      },
      { once: true },
    )
  })
}
