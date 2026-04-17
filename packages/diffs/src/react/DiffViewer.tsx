import { useMemo, useState, useEffect, useRef } from 'react'
import { computeDiff, type DiffResult, type DiffLine, type IntraLineSpan } from '../compute'
import { tokenizeLines, langFromPath, type SyntaxToken } from '../highlighter'

export interface DiffViewerProps {
  oldText: string
  newText: string
  fileName?: string
  language?: string
  maxInlineLines?: number
  className?: string
}

const TRUNCATED_LINES = 80

export function DiffViewer({
  oldText,
  newText,
  fileName,
  language,
  maxInlineLines = 300,
  className,
}: DiffViewerProps) {
  const diff = useMemo(
    () => computeDiff(oldText, newText),
    [oldText, newText],
  )

  const lang = language ? langFromPath(language) : fileName ? langFromPath(fileName) : 'text'
  const highlighted = useHighlightedDiff(diff, lang)

  if (!diff.hasChanges) return null

  const activeDiff = highlighted ?? diff
  const isLarge = activeDiff.lines.length > maxInlineLines

  return (
    <div
      className={className}
      style={{ contain: 'content' }}
    >
      {fileName != null && (
        <DiffHeader fileName={fileName} additions={diff.additions} deletions={diff.deletions} />
      )}
      {isLarge ? (
        <TruncatedDiff diff={activeDiff} initialLines={TRUNCATED_LINES} />
      ) : (
        <DiffBody lines={activeDiff.lines} />
      )}
    </div>
  )
}

function useHighlightedDiff(diff: DiffResult, lang: string): DiffResult | null {
  const [result, setResult] = useState<DiffResult | null>(null)
  const versionRef = useRef(0)

  useEffect(() => {
    if (lang === 'text' || !diff.hasChanges) return

    const version = ++versionRef.current

    const oldLines: string[] = []
    const newLines: string[] = []
    for (const line of diff.lines) {
      const text = line.spans.map(s => s.text).join('')
      if (line.type === 'deletion') {
        oldLines.push(text)
      } else if (line.type === 'addition') {
        newLines.push(text)
      } else {
        oldLines.push(text)
        newLines.push(text)
      }
    }

    Promise.all([
      oldLines.length > 0 ? tokenizeLines(oldLines, lang) : Promise.resolve([]),
      newLines.length > 0 ? tokenizeLines(newLines, lang) : Promise.resolve([]),
    ]).then(([oldTokens, newTokens]) => {
      if (version !== versionRef.current) return

      let oldIdx = 0
      let newIdx = 0
      const highlighted: DiffLine[] = diff.lines.map(line => {
        let syntaxTokens: SyntaxToken[]
        if (line.type === 'deletion') {
          syntaxTokens = oldTokens[oldIdx++] ?? []
        } else if (line.type === 'addition') {
          syntaxTokens = newTokens[newIdx++] ?? []
        } else {
          syntaxTokens = oldTokens[oldIdx++] ?? []
          newIdx++
        }

        return {
          ...line,
          spans: mergeSpans(line.spans, syntaxTokens),
        }
      })

      setResult({
        ...diff,
        lines: highlighted,
      })
    }).catch(() => {
      // highlighting failed, keep plain
    })

    return () => { versionRef.current++ }
  }, [diff, lang])

  return result
}

function mergeSpans(diffSpans: IntraLineSpan[], syntaxTokens: SyntaxToken[]): IntraLineSpan[] {
  if (syntaxTokens.length === 0) return diffSpans

  const result: IntraLineSpan[] = []
  let syntaxIdx = 0
  let syntaxOffset = 0

  for (const span of diffSpans) {
    let remaining = span.text.length
    if (remaining === 0) continue

    while (remaining > 0 && syntaxIdx < syntaxTokens.length) {
      const token = syntaxTokens[syntaxIdx]
      const tokenRemaining = token.text.length - syntaxOffset
      const take = Math.min(remaining, tokenRemaining)

      result.push({
        text: span.text.slice(span.text.length - remaining, span.text.length - remaining + take),
        highlighted: span.highlighted,
        color: token.color,
      })

      remaining -= take
      syntaxOffset += take
      if (syntaxOffset >= token.text.length) {
        syntaxIdx++
        syntaxOffset = 0
      }
    }

    if (remaining > 0) {
      result.push({
        text: span.text.slice(span.text.length - remaining),
        highlighted: span.highlighted,
      })
    }
  }

  return result
}

function DiffHeader({ fileName, additions, deletions }: { fileName: string; additions: number; deletions: number }) {
  const basename = fileName.split('/').pop() ?? fileName

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 8px',
        fontSize: '11px',
        fontFamily: 'var(--font-mono, ui-monospace, monospace)',
        borderBottom: '1px solid var(--diff-border, rgba(0,0,0,0.1))',
        color: 'var(--diff-header-fg, rgba(0,0,0,0.5))',
        background: 'var(--diff-header-bg, rgba(0,0,0,0.02))',
      }}
    >
      <span style={{ color: 'var(--diff-header-name, rgba(0,0,0,0.7))' }}>{basename}</span>
      {additions > 0 && <span style={{ color: 'var(--diff-add-fg, #3fb950)' }}>+{additions}</span>}
      {deletions > 0 && <span style={{ color: 'var(--diff-del-fg, #f85149)' }}>-{deletions}</span>}
      <span
        style={{ marginLeft: 'auto', fontSize: '10px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        title={fileName}
      >
        {fileName}
      </span>
    </div>
  )
}

function TruncatedDiff({ diff, initialLines }: { diff: DiffResult; initialLines: number }) {
  const [expanded, setExpanded] = useState(false)
  const lines = expanded ? diff.lines : diff.lines.slice(0, initialLines)
  const remaining = diff.lines.length - initialLines

  return (
    <>
      <DiffBody lines={lines} />
      {!expanded && remaining > 0 && (
        <button
          onClick={() => setExpanded(true)}
          style={{
            width: '100%',
            padding: '4px',
            fontSize: '11px',
            color: 'var(--diff-expand-fg, rgba(0,0,0,0.4))',
            background: 'var(--diff-expand-bg, rgba(0,0,0,0.03))',
            border: 'none',
            borderTop: '1px solid var(--diff-border, rgba(0,0,0,0.1))',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono, ui-monospace, monospace)',
          }}
        >
          Show {remaining} more lines
        </button>
      )}
    </>
  )
}

function DiffBody({ lines }: { lines: DiffLine[] }) {
  return (
    <div
      role="table"
      aria-label="Diff"
      style={{
        fontFamily: 'var(--font-mono, ui-monospace, monospace)',
        fontSize: 'var(--diff-font-size, 12px)',
        lineHeight: 'var(--diff-line-height, 18px)',
        overflow: 'auto',
        tabSize: 2,
      }}
    >
      {lines.map((line, i) => (
        <DiffRow key={i} line={line} />
      ))}
    </div>
  )
}

const ROW_STYLES: Record<string, React.CSSProperties> = {
  addition: {
    background: 'var(--diff-add-bg, rgba(46, 160, 67, 0.08))',
  },
  deletion: {
    background: 'var(--diff-del-bg, rgba(248, 81, 73, 0.08))',
  },
  context: {},
}

const BAR_COLORS: Record<string, string> = {
  addition: 'var(--diff-add-bar, rgba(63, 185, 80, 0.7))',
  deletion: 'var(--diff-del-bar, rgba(248, 81, 73, 0.7))',
  context: 'transparent',
}

function DiffRow({ line }: { line: DiffLine }) {
  return (
    <div
      role="row"
      style={{
        display: 'flex',
        ...ROW_STYLES[line.type],
      }}
    >
      <span
        aria-hidden
        style={{
          width: '3px',
          minWidth: '3px',
          flexShrink: 0,
          background: BAR_COLORS[line.type],
        }}
      />
      <span
        role="cell"
        style={{
          flex: 1,
          whiteSpace: 'pre',
          overflow: 'hidden',
          paddingLeft: '6px',
        }}
      >
        <LineContent spans={line.spans} type={line.type} />
      </span>
    </div>
  )
}

function LineContent({ spans, type }: { spans: IntraLineSpan[]; type: string }) {
  if (spans.length === 1 && !spans[0].highlighted && !spans[0].color) {
    return <>{spans[0].text || ' '}</>
  }

  return (
    <>
      {spans.map((span, i) => {
        if (!span.highlighted && !span.color) return <span key={i}>{span.text}</span>

        const style: React.CSSProperties = {}
        if (span.color) style.color = span.color
        if (span.highlighted) {
          style.background = type === 'deletion'
            ? 'var(--diff-del-emphasis, rgba(248, 81, 73, 0.25))'
            : 'var(--diff-add-emphasis, rgba(46, 160, 67, 0.25))'
          style.borderRadius = '2px'
        }

        return <span key={i} style={style}>{span.text}</span>
      })}
    </>
  )
}
