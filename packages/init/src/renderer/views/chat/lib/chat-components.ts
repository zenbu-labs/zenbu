import type { ComponentType } from "react"
import type {
  ToolCallContentItem,
  ToolMessageData,
  PlanEntry,
  PermissionOption,
  AuthMethodInfo,
} from "./materialize"

export type UserMessageProps = {
  content: string
  images?: { blobId: string; mimeType: string }[]
}

export type AssistantMessageProps = {
  content: string
}

export type ThinkingBlockProps = {
  content: string
}

export type ToolCallProps = {
  toolCallId: string
  title: string
  subtitle: string
  kind: string
  status: string
  contentItems: ToolCallContentItem[]
  rawOutput: unknown
  rawInput: unknown
  toolName: string
  toolResponse: { stdout?: string; stderr?: string } | null
  children: ToolMessageData[]
}

export type PlanProps = {
  entries: PlanEntry[]
}

export type PermissionRequestProps = {
  /**
   * Stable id used to pair a response to this request. The UI passes it
   * through `onSelect`; the response is written to the event log under
   * the same id so the agent-process subscription can resolve the
   * corresponding pending ACP call.
   */
  requestId: string
  toolCallId: string
  title: string
  kind: string
  description: string
  options: PermissionOption[]
  /**
   * User picked one of the `options` (by optionId) or cancelled. The
   * caller is responsible for writing the response event — the component
   * is otherwise a dumb renderer.
   */
  onSelect: (optionId: string | "__cancel__") => void
  /** Set once the matching permission_response has been observed. */
  selectedOptionId?: string
  cancelled?: boolean
}

export type AskQuestionProps = {
  toolCallId: string
  question: string
  onSubmit: (answer: string) => void
}

export type LoadingProps = {
  messages: import("./materialize").MaterializedMessage[]
}

export type InterruptedProps = Record<string, never>

export type AuthEventProps = {
  status: string
  authMethods: AuthMethodInfo[]
}

export interface ChatComponents {
  UserMessage: ComponentType<UserMessageProps>
  AssistantMessage: ComponentType<AssistantMessageProps>
  ThinkingBlock: ComponentType<ThinkingBlockProps>
  ToolCall: ComponentType<ToolCallProps>
  Plan: ComponentType<PlanProps>
  PermissionRequest: ComponentType<PermissionRequestProps>
  AskQuestion: ComponentType<AskQuestionProps>
  Loading: ComponentType<LoadingProps>
  Interrupted: ComponentType<InterruptedProps>
  AuthEvent: ComponentType<AuthEventProps>
  containerClassName: string
}
