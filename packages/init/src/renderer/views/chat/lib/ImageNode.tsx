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
import { ImagePill } from "../components/ImagePill"
import { JSX } from "react"

export type ImageStatus = "uploading" | "ready"

type SerializedImageNode = Spread<
  { blobId: string; mimeType: string; status: ImageStatus },
  SerializedLexicalNode
>

export class ImageNode extends DecoratorNode<JSX.Element> {
  __blobId: string
  __mimeType: string
  __status: ImageStatus
  __localSrc: string | null

  static getType(): string {
    return "image"
  }

  static clone(node: ImageNode): ImageNode {
    const cloned = new ImageNode(node.__blobId, node.__mimeType, node.__status, node.__localSrc, node.__key)
    return cloned
  }

  constructor(blobId: string, mimeType: string, status: ImageStatus, localSrc?: string | null, key?: NodeKey) {
    super(key)
    this.__blobId = blobId
    this.__mimeType = mimeType
    this.__status = status
    this.__localSrc = localSrc ?? null
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const span = document.createElement("span")
    span.style.display = "inline"
    return span
  }

  updateDOM(): false {
    return false
  }

  setStatus(status: ImageStatus): void {
    const self = this.getWritable()
    self.__status = status
  }

  decorate(): JSX.Element {
    return (
      <ImagePill
        nodeKey={this.__key}
        blobId={this.__blobId}
        mimeType={this.__mimeType}
        status={this.__status}
        localSrc={this.__localSrc}
      />
    )
  }

  isInline(): boolean {
    return true
  }

  isIsolated(): boolean {
    return true
  }

  exportDOM(_editor: LexicalEditor): DOMExportOutput {
    const span = document.createElement("span")
    span.setAttribute("data-lexical-image", "true")
    span.setAttribute("data-blob-id", this.__blobId)
    span.setAttribute("data-mime-type", this.__mimeType)
    span.setAttribute("data-status", this.__status)
    span.textContent = `[Image]`
    return { element: span }
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (node: HTMLElement) => {
        if (!node.hasAttribute("data-lexical-image")) return null
        return { conversion: convertImageElement, priority: 1 }
      },
    }
  }

  exportJSON(): SerializedImageNode {
    return {
      type: "image",
      version: 1,
      blobId: this.__blobId,
      mimeType: this.__mimeType,
      status: this.__status,
    }
  }

  static importJSON(json: SerializedImageNode): ImageNode {
    return new ImageNode(json.blobId, json.mimeType, json.status)
  }

  getTextContent(): string {
    return `[Image]`
  }

  getBlobId(): string {
    return this.__blobId
  }

  getMimeType(): string {
    return this.__mimeType
  }

  getStatus(): ImageStatus {
    return this.__status
  }
}

function convertImageElement(element: HTMLElement): DOMConversionOutput {
  const blobId = element.getAttribute("data-blob-id")
  const mimeType = element.getAttribute("data-mime-type")
  const status = element.getAttribute("data-status") as ImageStatus
  if (blobId && mimeType) {
    return { node: new ImageNode(blobId, mimeType, status ?? "ready") }
  }
  return { node: null }
}

export function $createImageNode(
  blobId: string,
  mimeType: string,
  status: ImageStatus = "uploading",
  localSrc?: string | null,
): ImageNode {
  return new ImageNode(blobId, mimeType, status, localSrc)
}

export function $isImageNode(
  node: LexicalNode | null | undefined,
): node is ImageNode {
  return node instanceof ImageNode
}
