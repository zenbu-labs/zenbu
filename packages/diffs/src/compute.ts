import { diffWordsWithSpace, diffChars } from 'diff'

export type DiffLineType = 'addition' | 'deletion' | 'context'

export interface IntraLineSpan {
  text: string
  highlighted: boolean
  color?: string
}

export interface DiffLine {
  type: DiffLineType
  oldNum: number | null
  newNum: number | null
  spans: IntraLineSpan[]
}

export interface DiffResult {
  lines: DiffLine[]
  additions: number
  deletions: number
  hasChanges: boolean
}

export function computeDiff(
  oldText: string,
  newText: string,
  options?: { lineDiffType?: 'word-alt' | 'word' | 'char' | 'none'; maxLineDiffLength?: number },
): DiffResult {
  const lineDiffType = options?.lineDiffType ?? 'word-alt'
  const maxLen = options?.maxLineDiffLength ?? 1000

  const oldLines = splitLines(oldText)
  const newLines = splitLines(newText)

  const editScript = myersDiff(oldLines, newLines)

  const lines: DiffLine[] = []
  let additions = 0
  let deletions = 0
  let i = 0
  let j = 0

  for (const op of editScript) {
    switch (op) {
      case 'keep': {
        lines.push({
          type: 'context',
          oldNum: i + 1,
          newNum: j + 1,
          spans: [{ text: oldLines[i], highlighted: false }],
        })
        i++
        j++
        break
      }
      case 'delete': {
        lines.push({
          type: 'deletion',
          oldNum: i + 1,
          newNum: null,
          spans: [{ text: oldLines[i], highlighted: false }],
        })
        deletions++
        i++
        break
      }
      case 'insert': {
        lines.push({
          type: 'addition',
          oldNum: null,
          newNum: j + 1,
          spans: [{ text: newLines[j], highlighted: false }],
        })
        additions++
        j++
        break
      }
    }
  }

  applyIntraLineDiffs(lines, lineDiffType, maxLen)

  while (lines.length > 0) {
    const last = lines[lines.length - 1]
    const text = last.spans.map(s => s.text).join('')
    if (text === '') {
      lines.pop()
    } else {
      break
    }
  }

  return { lines, additions, deletions, hasChanges: additions > 0 || deletions > 0 }
}

function applyIntraLineDiffs(lines: DiffLine[], type: string, maxLen: number) {
  if (type === 'none') return

  let i = 0
  while (i < lines.length) {
    if (lines[i].type === 'deletion') {
      const delStart = i
      let delEnd = i
      while (delEnd < lines.length && lines[delEnd].type === 'deletion') delEnd++
      let addStart = delEnd
      let addEnd = delEnd
      while (addEnd < lines.length && lines[addEnd].type === 'addition') addEnd++

      const pairCount = Math.min(delEnd - delStart, addEnd - addStart)
      for (let p = 0; p < pairCount; p++) {
        const del = lines[delStart + p]
        const add = lines[addStart + p]
        const delText = del.spans.map(s => s.text).join('')
        const addText = add.spans.map(s => s.text).join('')

        if (delText.length > maxLen || addText.length > maxLen) continue

        const diffFn = type === 'char' ? diffChars : diffWordsWithSpace
        const changes = diffFn(delText, addText)

        const delSpans: IntraLineSpan[] = []
        const addSpans: IntraLineSpan[] = []
        for (const change of changes) {
          if (!change.added && !change.removed) {
            delSpans.push({ text: change.value, highlighted: false })
            addSpans.push({ text: change.value, highlighted: false })
          } else if (change.removed) {
            delSpans.push({ text: change.value, highlighted: true })
          } else {
            addSpans.push({ text: change.value, highlighted: true })
          }
        }

        if (type === 'word-alt') {
          joinAdjacentSpans(delSpans)
          joinAdjacentSpans(addSpans)
        }

        del.spans = delSpans
        add.spans = addSpans
      }

      i = addEnd
    } else {
      i++
    }
  }
}

function joinAdjacentSpans(spans: IntraLineSpan[]) {
  let i = 0
  while (i < spans.length - 2) {
    const a = spans[i]
    const b = spans[i + 1]
    const c = spans[i + 2]
    if (a.highlighted && !b.highlighted && c.highlighted && b.text.length === 1) {
      spans.splice(i, 3, { text: a.text + b.text + c.text, highlighted: true })
    } else {
      i++
    }
  }
}

function splitLines(text: string): string[] {
  if (text === '') return []
  const lines = text.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  return lines
}

type EditOp = 'keep' | 'insert' | 'delete'

function myersDiff(a: string[], b: string[]): EditOp[] {
  const n = a.length
  const m = b.length
  const max = n + m

  if (max === 0) return []
  if (n === 0) return Array(m).fill('insert')
  if (m === 0) return Array(n).fill('delete')

  const vSize = 2 * max + 1
  const v = new Int32Array(vSize).fill(-1)
  const offset = max
  v[offset + 1] = 0

  const trace: Int32Array[] = []

  outer:
  for (let d = 0; d <= max; d++) {
    const vCopy = new Int32Array(vSize)
    vCopy.set(v)
    trace.push(vCopy)

    for (let k = -d; k <= d; k += 2) {
      let x: number
      if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) {
        x = v[offset + k + 1]
      } else {
        x = v[offset + k - 1] + 1
      }
      let y = x - k
      while (x < n && y < m && a[x] === b[y]) {
        x++
        y++
      }
      v[offset + k] = x
      if (x >= n && y >= m) break outer
    }
  }

  const ops: EditOp[] = []
  let x = n
  let y = m
  for (let d = trace.length - 1; d > 0; d--) {
    const vPrev = trace[d - 1]
    const k = x - y
    let prevK: number
    if (k === -d || (k !== d && vPrev[offset + k - 1] < vPrev[offset + k + 1])) {
      prevK = k + 1
    } else {
      prevK = k - 1
    }
    const prevX = vPrev[offset + prevK]
    const prevY = prevX - prevK

    while (x > prevX && y > prevY) {
      ops.push('keep')
      x--
      y--
    }

    if (d > 0) {
      if (x === prevX) {
        ops.push('insert')
        y--
      } else {
        ops.push('delete')
        x--
      }
    }
  }
  while (x > 0 && y > 0) {
    ops.push('keep')
    x--
    y--
  }

  return ops.reverse()
}
