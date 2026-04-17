function getLineClass(line: string) {
  if (line.startsWith("@@")) return "bg-cyan-50 text-cyan-700"
  if (line.startsWith("+") && !line.startsWith("+++")) return "bg-emerald-50 text-emerald-700"
  if (line.startsWith("-") && !line.startsWith("---")) return "bg-rose-50 text-rose-700"
  return "text-neutral-600"
}

export function DiffView({ path, diff }: { path: string; diff: string }) {
  if (!diff.trim()) {
    return null
  }

  const hasHeader = diff.startsWith("---") || diff.startsWith("diff ")
  const patch = hasHeader ? diff : `--- a/${path}\n+++ b/${path}\n${diff}`
  const lines = patch.split("\n")

  return (
    <div className="overflow-x-auto rounded border border-neutral-300 bg-white">
      {lines.map((line, index) => (
        <div
          key={`${index}-${line}`}
          className={`px-3 py-0.5 font-mono text-xs whitespace-pre ${getLineClass(line)}`}
        >
          {line || " "}
        </div>
      ))}
    </div>
  )
}
