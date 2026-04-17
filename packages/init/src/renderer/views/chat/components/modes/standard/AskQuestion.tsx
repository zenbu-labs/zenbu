import type { AskQuestionProps } from "../../../lib/chat-components"
import { AskQuestionCard } from "../../AskQuestionCard"

export function AskQuestion({ question, onSubmit }: AskQuestionProps) {
  return <div className="px-3"><AskQuestionCard question={question} onSubmit={onSubmit} /></div>
}
