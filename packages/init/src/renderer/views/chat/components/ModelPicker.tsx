type ModelPickerProps = {
  models: Array<{ value: string; name: string }>
  selectedValue: string
  onSelect: (value: string) => void
}

export function ModelPicker({
  models,
  selectedValue,
  onSelect,
}: ModelPickerProps) {
  return (
    <select
      value={selectedValue}
      onChange={(e) => onSelect(e.target.value)}
      className="h-6 rounded border border-neutral-300 bg-white px-1.5 text-[11px] text-neutral-600 outline-none focus:border-neutral-400"
    >
      {models.map((model) => (
        <option key={model.value} value={model.value}>
          {model.name}
        </option>
      ))}
    </select>
  )
}
