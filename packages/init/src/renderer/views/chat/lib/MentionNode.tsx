import type { EditorConfig, LexicalNode, NodeKey, SerializedLexicalNode, Spread } from "lexical"
import { DecoratorNode } from "lexical"
import { MentionPill } from "../components/MentionPill"

export type MentionType = "file" | "command" | "symbol" | "url"

type SerializedMentionNode = Spread<
  { mentionType: MentionType; label: string },
  SerializedLexicalNode
>

export class MentionNode extends DecoratorNode<JSX.Element> {
  __mentionType: MentionType
  __label: string

  static getType(): string {
    return "mention"
  }

  static clone(node: MentionNode): MentionNode {
    return new MentionNode(node.__mentionType, node.__label, node.__key)
  }

  constructor(mentionType: MentionType, label: string, key?: NodeKey) {
    super(key)
    this.__mentionType = mentionType
    this.__label = label
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const span = document.createElement("span")
    span.style.display = "inline"
    return span
  }

  updateDOM(): false {
    return false
  }

  decorate(): JSX.Element {
    return <MentionPill type={this.__mentionType} label={this.__label} />
  }

  isInline(): boolean {
    return true
  }

  isIsolated(): boolean {
    return true
  }

  exportJSON(): SerializedMentionNode {
    return {
      type: "mention",
      version: 1,
      mentionType: this.__mentionType,
      label: this.__label,
    }
  }

  static importJSON(json: SerializedMentionNode): MentionNode {
    return new MentionNode(json.mentionType, json.label)
  }

  getTextContent(): string {
    return this.__label
  }
}

export function $createMentionNode(
  mentionType: MentionType,
  label: string,
): MentionNode {
  return new MentionNode(mentionType, label)
}

export function $isMentionNode(node: LexicalNode | null | undefined): node is MentionNode {
  return node instanceof MentionNode
}
