import { useState } from "react"

type AskQuestionCardProps = {
  question: string
  onSubmit: (answer: string) => void
  onDismiss?: () => void
  placeholder?: string
  submitting?: boolean
}

export function AskQuestionCard({
  question,
  onSubmit,
  onDismiss,
  placeholder = "Type your answer...",
  submitting = false,
}: AskQuestionCardProps) {
  const [answer, setAnswer] = useState("")

  return (
    <div className="w-full rounded border border-neutral-300 overflow-hidden">
      <div className="px-3 py-2.5">
        <p className="text-sm text-neutral-800 leading-relaxed mb-3">
          {question}
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={submitting}
            placeholder={placeholder}
            className="flex-1 h-8 rounded border border-neutral-300 bg-white px-2.5 text-sm text-neutral-700 outline-none focus:border-neutral-400 disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === "Enter" && answer.trim()) {
                onSubmit(answer)
              }
            }}
          />
          <button
            type="button"
            onClick={() => onSubmit(answer)}
            disabled={submitting || !answer.trim()}
            className="h-8 rounded border border-neutral-300 bg-neutral-800 px-3 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 flex items-center gap-1.5 shrink-0"
          >
            {submitting && (
              <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin-slow" />
            )}
            Submit
          </button>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            disabled={submitting}
            className="mt-2 text-sm text-neutral-500 hover:text-neutral-700 disabled:opacity-50"
          >
            Skip this question
          </button>
        )}
      </div>
    </div>
  )
}
