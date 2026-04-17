import type { MaterializedItem, VirtualItemPosition } from './types'

const PREFIX = '[virtualizer invariant violation]'

/**
 * Assert that all materialized items have unique keys.
 * Duplicate keys cause the virtualizer to overwrite positions,
 * producing garbled rendering order.
 */
export function assertUniqueKeys<TView>(
  items: MaterializedItem<TView>[],
  context: string,
): void {
  if (process.env.NODE_ENV === 'production') return

  const seen = new Map<string, number>()
  for (let i = 0; i < items.length; i++) {
    const key = items[i].key
    const prev = seen.get(key)
    if (prev !== undefined) {
      console.error(
        `${PREFIX} DUPLICATE KEY "${key}" at indices ${prev} and ${i} (${context}).\n` +
        `  first:     cacheKey="${items[prev].cacheKey}", seqRange=[${items[prev].seqRange}]\n` +
        `  duplicate: cacheKey="${items[i].cacheKey}", seqRange=[${items[i].seqRange}]\n` +
        `This will cause the virtualizer to render items in wrong positions.`,
      )
    } else {
      seen.set(key, i)
    }
  }
}

/**
 * Assert that items are ordered by seqRange (non-decreasing start).
 * If item A appears before item B in the array, A.seqRange[0] <= B.seqRange[0].
 * Violation means events were processed or items were ordered incorrectly.
 */
export function assertSeqRangeOrdering<TView>(
  items: MaterializedItem<TView>[],
  context: string,
): void {
  if (process.env.NODE_ENV === 'production') return

  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1]
    const curr = items[i]
    if (curr.seqRange[0] < prev.seqRange[0]) {
      console.error(
        `${PREFIX} SEQRANGE ORDERING violated at index ${i} (${context}).\n` +
        `  item[${i - 1}]: key="${prev.key}", seqRange=[${prev.seqRange}]\n` +
        `  item[${i}]:   key="${curr.key}", seqRange=[${curr.seqRange}]\n` +
        `Items must be ordered by ascending seqRange start.`,
      )
      break
    }
  }
}

/**
 * Assert that blocks from the same message/group are contiguous.
 * Group identity is the key prefix before the first colon
 * (e.g. "int-u-0" from "int-u-0:text:0").
 *
 * If blocks from group A are split by blocks from group B,
 * messages are visually interleaved.
 */
export function assertBlockContiguity<TView>(
  items: MaterializedItem<TView>[],
  context: string,
): void {
  if (process.env.NODE_ENV === 'production') return

  function getGroupId(key: string): string {
    const idx = key.indexOf(':')
    return idx === -1 ? key : key.substring(0, idx)
  }

  // When we transition from one group to another, the old group is "closed".
  // If a closed group reappears, contiguity is violated.
  const closedGroups = new Map<string, number>()
  let currentGroupId: string | null = null

  for (let i = 0; i < items.length; i++) {
    const groupId = getGroupId(items[i].key)

    if (groupId !== currentGroupId) {
      // Transitioning to a different group — close the previous one
      if (currentGroupId !== null && !closedGroups.has(currentGroupId)) {
        closedGroups.set(currentGroupId, i - 1)
      }

      if (closedGroups.has(groupId)) {
        const lastIdx = closedGroups.get(groupId)!
        const interlopers: string[] = []
        for (let j = lastIdx + 1; j < i && interlopers.length < 5; j++) {
          interlopers.push(`    [${j}]: key="${items[j].key}"`)
        }
        console.error(
          `${PREFIX} BLOCK CONTIGUITY violated for group "${groupId}" (${context}).\n` +
          `  Last block at index ${lastIdx}: key="${items[lastIdx].key}"\n` +
          `  Reappears at index ${i}: key="${items[i].key}"\n` +
          `  Interleaved items:\n${interlopers.join('\n')}` +
          (i - lastIdx - 1 > 5 ? `\n    ... and ${i - lastIdx - 6} more` : '') +
          `\n  Blocks from the same message must be contiguous.`,
        )
        break
      }

      currentGroupId = groupId
    }
  }
}

/**
 * Assert that positions have consistent cumulative offsets.
 * offset[i] must equal sum of size[0..i-1].
 */
export function assertPositionConsistency(
  positions: VirtualItemPosition[],
  context: string,
): void {
  if (process.env.NODE_ENV === 'production') return

  let expectedOffset = 0
  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i]

    if (pos.size <= 0) {
      console.error(
        `${PREFIX} NON-POSITIVE SIZE ${pos.size} at index ${i}, key="${pos.key}" (${context}).`,
      )
    }

    if (Math.abs(pos.offset - expectedOffset) > 0.5) {
      console.error(
        `${PREFIX} POSITION OFFSET INCONSISTENCY at index ${i}, key="${pos.key}" (${context}).\n` +
        `  expected offset=${expectedOffset.toFixed(1)}, actual offset=${pos.offset.toFixed(1)}\n` +
        `  Cumulative sizes don't match position offsets.`,
      )
      break
    }

    expectedOffset += pos.size
  }

  // Also check for duplicate keys in positions
  const seen = new Map<string, number>()
  for (let i = 0; i < positions.length; i++) {
    const key = positions[i].key
    const prev = seen.get(key)
    if (prev !== undefined) {
      console.error(
        `${PREFIX} DUPLICATE POSITION KEY "${key}" at indices ${prev} and ${i} (${context}).`,
      )
    } else {
      seen.set(key, i)
    }
  }
}

/**
 * Run all materialized-item invariants.
 * Call this after any operation that produces or transforms MaterializedItem[].
 */
export function assertMaterializedItems<TView>(
  items: MaterializedItem<TView>[],
  context: string,
): void {
  if (process.env.NODE_ENV === 'production') return
  if (items.length === 0) return
  assertUniqueKeys(items, context)
  assertSeqRangeOrdering(items, context)
  assertBlockContiguity(items, context)
}
