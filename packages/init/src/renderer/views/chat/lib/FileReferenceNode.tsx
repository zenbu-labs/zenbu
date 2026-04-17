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
import { FileReferencePill } from "../components/FileReferencePill"
import { JSX } from "react";

type SerializedFileReferenceNode = Spread<
  { filePath: string; fileName: string; fileContent: string },
  SerializedLexicalNode
>

export class FileReferenceNode extends DecoratorNode<JSX.Element> {
  __filePath: string
  __fileName: string
  __fileContent: string

  static getType(): string {
    return "file-reference"
  }

  static clone(node: FileReferenceNode): FileReferenceNode {
    return new FileReferenceNode(
      node.__filePath,
      node.__fileName,
      node.__fileContent,
      node.__key,
    )
  }

  constructor(filePath: string, fileName: string, fileContent: string, key?: NodeKey) {
    super(key)
    this.__filePath = filePath
    this.__fileName = fileName
    this.__fileContent = fileContent
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
    return <FileReferencePill fileName={this.__fileName} filePath={this.__filePath} />
  }

  isInline(): boolean {
    return true
  }

  isIsolated(): boolean {
    return true
  }

  exportDOM(_editor: LexicalEditor): DOMExportOutput {
    const span = document.createElement("span")
    span.setAttribute("data-lexical-file-reference", "true")
    span.setAttribute("data-file-path", this.__filePath)
    span.setAttribute("data-file-name", this.__fileName)
    span.setAttribute("data-file-content", this.__fileContent)
    span.textContent = this.__fileName
    return { element: span }
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (node: HTMLElement) => {
        if (!node.hasAttribute("data-lexical-file-reference")) return null
        return { conversion: convertFileReferenceElement, priority: 1 }
      },
    }
  }

  exportJSON(): SerializedFileReferenceNode {
    return {
      type: "file-reference",
      version: 1,
      filePath: this.__filePath,
      fileName: this.__fileName,
      fileContent: this.__fileContent,
    }
  }

  static importJSON(json: SerializedFileReferenceNode): FileReferenceNode {
    return new FileReferenceNode(json.filePath, json.fileName, json.fileContent)
  }

  getTextContent(): string {
    return this.__fileName
  }

  getFilePath(): string {
    return this.__filePath
  }

  getFileName(): string {
    return this.__fileName
  }

  getFileContent(): string {
    return this.__fileContent
  }
}

function convertFileReferenceElement(element: HTMLElement): DOMConversionOutput {
  const filePath = element.getAttribute("data-file-path")
  const fileName = element.getAttribute("data-file-name")
  const fileContent = element.getAttribute("data-file-content")
  if (filePath && fileName) {
    return { node: new FileReferenceNode(filePath, fileName, fileContent ?? "") }
  }
  return { node: null }
}

export function $createFileReferenceNode(
  filePath: string,
  fileName: string,
  fileContent: string,
): FileReferenceNode {
  return new FileReferenceNode(filePath, fileName, fileContent)
}

export function $isFileReferenceNode(
  node: LexicalNode | null | undefined,
): node is FileReferenceNode {
  return node instanceof FileReferenceNode
}
