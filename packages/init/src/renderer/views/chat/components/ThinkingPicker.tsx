type ThinkingPickerProps = {
  levels: Array<{ value: string; name: string }>
  selectedValue: string
  onSelect: (value: string) => void
}

export function ThinkingPicker({
  levels,
  selectedValue,
  onSelect,
}: ThinkingPickerProps) {
  return (
    <select
      value={selectedValue}
      onChange={(e) => onSelect(e.target.value)}
      className="h-6 rounded border border-neutral-300 bg-white px-1.5 text-[11px] text-neutral-600 outline-none focus:border-neutral-400"
    >
      {levels.map((level) => (
        <option key={level.value} value={level.value}>
          {level.name}
        </option>
      ))}
    </select>
  )
}
