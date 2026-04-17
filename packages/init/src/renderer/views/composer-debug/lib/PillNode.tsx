import type { ReactElement } from "react"
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
import { Pill } from "../components/Pill"

export type PillData = {
  kind: string
  label: string
  payload: Record<string, unknown>
}

type SerializedPillNode = Spread<{ pillData: PillData }, SerializedLexicalNode>

export class PillNode extends DecoratorNode<ReactElement> {
  __data: PillData

  static getType(): string {
    return "pill"
  }

  static clone(node: PillNode): PillNode {
    return new PillNode(node.__data, node.__key)
  }

  constructor(data: PillData, key?: NodeKey) {
    super(key)
    this.__data = data
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const span = document.createElement("span")
    span.style.display = "inline"
    return span
  }

  updateDOM(): false {
    return false
  }

  decorate(): ReactElement {
    return <Pill data={this.__data} />
  }

  isInline(): boolean {
    return true
  }

  isIsolated(): boolean {
    return true
  }

  exportDOM(_editor: LexicalEditor): DOMExportOutput {
    const span = document.createElement("span")
    span.setAttribute("data-lexical-pill", "true")
    span.setAttribute("data-pill-data", JSON.stringify(this.__data))
    span.textContent = this.__data.label
    return { element: span }
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (node: HTMLElement) => {
        if (!node.hasAttribute("data-lexical-pill")) return null
        return {
          conversion: convertPillElement,
          priority: 1,
        }
      },
    }
  }

  exportJSON(): SerializedPillNode {
    return {
      type: "pill",
      version: 1,
      pillData: this.__data,
    }
  }

  static importJSON(json: SerializedPillNode): PillNode {
    return new PillNode(json.pillData)
  }

  getTextContent(): string {
    return this.__data.label
  }

  getData(): PillData {
    return this.__data
  }
}

function convertPillElement(element: HTMLElement): DOMConversionOutput {
  const raw = element.getAttribute("data-pill-data")
  if (raw) {
    try {
      const data = JSON.parse(raw) as PillData
      return { node: new PillNode(data) }
    } catch {
      // fall through
    }
  }
  return { node: null }
}

export function $createPillNode(data: PillData): PillNode {
  return new PillNode(data)
}

export function $isPillNode(
  node: LexicalNode | null | undefined,
): node is PillNode {
  return node instanceof PillNode
}
