import type {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from "lexical"
import { DecoratorNode } from "lexical"
import { JSX } from "react"
import type { TokenPayload } from "../../../../../shared/tokens"
import { TokenPill } from "../components/TokenPill"

type SerializedTokenNode = Spread<
  { payload: TokenPayload },
  SerializedLexicalNode
>

/**
 * A generic pill node whose entire state is a JSON-serializable TokenPayload.
 * All new pills (files, images, folders, future kinds) flow through this
 * one node class — the old FileReferenceNode / ImageNode classes are kept
 * registered only so legacy drafts continue to deserialize during migration.
 *
 * Round-trip invariant: exportJSON → JSON.stringify → JSON.parse → importJSON
 * produces an identical node. This is what lets InsertService append a
 * token to a session's persisted editor state on the main process without
 * ever instantiating a LexicalEditor.
 */
export class TokenNode extends DecoratorNode<JSX.Element> {
  __payload: TokenPayload

  static getType(): string {
    return "token"
  }

  static clone(node: TokenNode): TokenNode {
    return new TokenNode(node.__payload, node.__key)
  }

  constructor(payload: TokenPayload, key?: NodeKey) {
    super(key)
    this.__payload = payload
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
    return <TokenPill nodeKey={this.__key} payload={this.__payload} />
  }

  isInline(): boolean {
    return true
  }

  isIsolated(): boolean {
    return true
  }

  exportDOM(_editor: LexicalEditor): DOMExportOutput {
    const span = document.createElement("span")
    span.setAttribute("data-lexical-token", "true")
    span.setAttribute("data-token-payload", JSON.stringify(this.__payload))
    span.textContent = this.__payload.title
    return { element: span }
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (node: HTMLElement) => {
        if (!node.hasAttribute("data-lexical-token")) return null
        return { conversion: convertTokenElement, priority: 1 }
      },
    }
  }

  exportJSON(): SerializedTokenNode {
    return {
      type: "token",
      version: 1,
      payload: this.__payload,
    }
  }

  static importJSON(json: SerializedTokenNode): TokenNode {
    return new TokenNode(json.payload)
  }

  getTextContent(): string {
    return this.__payload.title
  }

  getPayload(): TokenPayload {
    return this.__payload
  }

  setPayload(next: TokenPayload): void {
    const self = this.getWritable()
    self.__payload = next
  }
}

function convertTokenElement(element: HTMLElement): DOMConversionOutput {
  const raw = element.getAttribute("data-token-payload")
  if (!raw) return { node: null }
  try {
    const payload = JSON.parse(raw) as TokenPayload
    return { node: new TokenNode(payload) }
  } catch {
    return { node: null }
  }
}

export function $createTokenNode(payload: TokenPayload): TokenNode {
  return new TokenNode(payload)
}

export function $isTokenNode(
  node: LexicalNode | null | undefined,
): node is TokenNode {
  return node instanceof TokenNode
}
