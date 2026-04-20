import type { TokenPayload } from "./tokens"

/**
 * Pure JSON operations on a Lexical editor state. Safe to call from the main
 * process (where no `LexicalEditor` exists) — used by InsertService when
 * appending a token to a session's persisted draft.
 *
 * The shapes here mirror `editor.getEditorState().toJSON()` output: a single
 * `root` element containing an array of `children`, each typically a
 * `paragraph` whose `children` are text / decorator nodes.
 */

type LexJsonNode = {
  type: string
  version?: number
  children?: LexJsonNode[]
  [key: string]: unknown
}

type LexJsonRoot = {
  root: LexJsonNode
}

const EMPTY_ROOT: LexJsonRoot = {
  root: {
    type: "root",
    version: 1,
    format: "",
    indent: 0,
    direction: null,
    children: [
      {
        type: "paragraph",
        version: 1,
        format: "",
        indent: 0,
        direction: null,
        textFormat: 0,
        textStyle: "",
        children: [],
      },
    ],
  },
}

function emptyRoot(): LexJsonRoot {
  return JSON.parse(JSON.stringify(EMPTY_ROOT))
}

function makeTokenNode(payload: TokenPayload): LexJsonNode {
  return {
    type: "token",
    version: 1,
    payload,
  }
}

function makeSpaceTextNode(): LexJsonNode {
  return {
    type: "text",
    version: 1,
    detail: 0,
    format: 0,
    mode: "normal",
    style: "",
    text: " ",
  }
}

/**
 * Append a TokenNode (plus a trailing space text node so the caret lands
 * after the pill on rehydrate) to the last paragraph of the editor state.
 * Synthesizes an empty state + paragraph if `input` is nullish.
 */
export function appendTokenToEditorState(
  input: unknown,
  payload: TokenPayload,
): LexJsonRoot {
  let state: LexJsonRoot
  if (!input || typeof input !== "object" || !("root" in (input as object))) {
    state = emptyRoot()
  } else {
    state = JSON.parse(JSON.stringify(input)) as LexJsonRoot
    if (!state.root || typeof state.root !== "object") {
      state = emptyRoot()
    }
  }

  const root = state.root
  const children = Array.isArray(root.children) ? root.children : []
  let lastPara = children[children.length - 1]
  if (!lastPara || lastPara.type !== "paragraph") {
    lastPara = {
      type: "paragraph",
      version: 1,
      format: "",
      indent: 0,
      direction: null,
      textFormat: 0,
      textStyle: "",
      children: [],
    }
    children.push(lastPara)
  }
  if (!Array.isArray(lastPara.children)) lastPara.children = []
  lastPara.children.push(makeTokenNode(payload), makeSpaceTextNode())
  root.children = children
  return state
}

/**
 * One-time migrator: walks an editor state JSON and rewrites legacy
 * `file-reference` / `image` nodes into the new `token` shape. Safe to call
 * on already-migrated state (it's idempotent — token nodes pass through).
 */
export function migrateLegacyNodesInEditorState(input: unknown): LexJsonRoot {
  if (!input || typeof input !== "object" || !("root" in (input as object))) {
    return emptyRoot()
  }
  const state = JSON.parse(JSON.stringify(input)) as LexJsonRoot
  if (!state.root) return emptyRoot()
  walkAndMigrate(state.root)
  return state
}

function walkAndMigrate(node: LexJsonNode): void {
  if (!Array.isArray(node.children)) return
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i]
    if (!child) continue
    if (child.type === "file-reference") {
      const filePath = typeof child.filePath === "string" ? child.filePath : ""
      const fileName = typeof child.fileName === "string" ? child.fileName : ""
      const fileContent =
        typeof child.fileContent === "string" ? child.fileContent : ""
      node.children[i] = makeTokenNode({
        kind: "file",
        title: fileName || filePath,
        data: { path: filePath, name: fileName, content: fileContent },
      })
      continue
    }
    if (child.type === "image") {
      const blobId = typeof child.blobId === "string" ? child.blobId : ""
      const mimeType =
        typeof child.mimeType === "string" ? child.mimeType : "image/png"
      const status = typeof child.status === "string" ? child.status : "ready"
      node.children[i] = makeTokenNode({
        kind: "image",
        title: "Image",
        data: { status },
        blobs: blobId ? [{ blobId, mimeType, role: "image" }] : [],
      })
      continue
    }
    walkAndMigrate(child)
  }
}
