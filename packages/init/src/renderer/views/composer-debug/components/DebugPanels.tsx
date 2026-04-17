import { useState, useMemo } from "react"
import type { EditorState, LexicalEditor } from "lexical"
import { TreeView } from "@lexical/react/LexicalTreeView"
import {
  serializeEditorState,
  extractPills,
  extractTextWithPills,
} from "../lib/serialize"
import type { PillData } from "../lib/PillNode"
import { Pill } from "./Pill"

type Tab = "tree" | "json" | "pills" | "segments" | "scenarios"

const SCENARIOS: { name: string; description: string; state: object }[] = [
  {
    name: "Empty",
    description: "Empty editor state",
    state: {
      root: {
        children: [{ children: [], direction: null, format: "", indent: 0, type: "paragraph", version: 1, textStyle: "", textFormat: 0 }],
        direction: null,
        format: "",
        indent: 0,
        type: "root",
        version: 1,
      },
    },
  },
  {
    name: "Text only",
    description: "Plain text without any pills",
    state: {
      root: {
        children: [
          {
            children: [
              { detail: 0, format: 0, mode: "normal", style: "", text: "Hello, this is a plain text message with no pills.", type: "text", version: 1 },
            ],
            direction: "ltr",
            format: "",
            indent: 0,
            type: "paragraph",
            version: 1,
            textStyle: "",
            textFormat: 0,
          },
        ],
        direction: "ltr",
        format: "",
        indent: 0,
        type: "root",
        version: 1,
      },
    },
  },
  {
    name: "Single mention",
    description: "Text with one @mention pill",
    state: {
      root: {
        children: [
          {
            children: [
              { detail: 0, format: 0, mode: "normal", style: "", text: "Hey ", type: "text", version: 1 },
              { type: "pill", version: 1, pillData: { kind: "mention", label: "alice", payload: { userId: "u1", role: "admin" } } },
              { detail: 0, format: 0, mode: "normal", style: "", text: " check this out", type: "text", version: 1 },
            ],
            direction: "ltr",
            format: "",
            indent: 0,
            type: "paragraph",
            version: 1,
            textStyle: "",
            textFormat: 0,
          },
        ],
        direction: "ltr",
        format: "",
        indent: 0,
        type: "root",
        version: 1,
      },
    },
  },
  {
    name: "Multiple pills",
    description: "Text with mixed pill types interspersed",
    state: {
      root: {
        children: [
          {
            children: [
              { detail: 0, format: 0, mode: "normal", style: "", text: "Look at ", type: "text", version: 1 },
              { type: "pill", version: 1, pillData: { kind: "file", label: "README.md", payload: { path: "/README.md" } } },
              { detail: 0, format: 0, mode: "normal", style: "", text: " and run ", type: "text", version: 1 },
              { type: "pill", version: 1, pillData: { kind: "command", label: "test", payload: { action: "test", description: "Run tests" } } },
              { detail: 0, format: 0, mode: "normal", style: "", text: " then ping ", type: "text", version: 1 },
              { type: "pill", version: 1, pillData: { kind: "mention", label: "bob", payload: { userId: "u2" } } },
            ],
            direction: "ltr",
            format: "",
            indent: 0,
            type: "paragraph",
            version: 1,
            textStyle: "",
            textFormat: 0,
          },
        ],
        direction: "ltr",
        format: "",
        indent: 0,
        type: "root",
        version: 1,
      },
    },
  },
  {
    name: "Adjacent pills",
    description: "Pills placed directly next to each other",
    state: {
      root: {
        children: [
          {
            children: [
              { type: "pill", version: 1, pillData: { kind: "file", label: "index.ts", payload: { path: "/src/index.ts" } } },
              { type: "pill", version: 1, pillData: { kind: "file", label: "app.tsx", payload: { path: "/src/app.tsx" } } },
              { type: "pill", version: 1, pillData: { kind: "symbol", label: "PillNode", payload: { type: "class" } } },
            ],
            direction: "ltr",
            format: "",
            indent: 0,
            type: "paragraph",
            version: 1,
            textStyle: "",
            textFormat: 0,
          },
        ],
        direction: "ltr",
        format: "",
        indent: 0,
        type: "root",
        version: 1,
      },
    },
  },
  {
    name: "Long labels",
    description: "Pills with very long label text to test truncation",
    state: {
      root: {
        children: [
          {
            children: [
              { detail: 0, format: 0, mode: "normal", style: "", text: "Check ", type: "text", version: 1 },
              { type: "pill", version: 1, pillData: { kind: "file", label: "apps/desktop/src/renderer/views/composer-debug/components/DebugPanels.tsx", payload: { path: "/apps/desktop/src/renderer/views/composer-debug/components/DebugPanels.tsx" } } },
              { detail: 0, format: 0, mode: "normal", style: "", text: " and ", type: "text", version: 1 },
              { type: "pill", version: 1, pillData: { kind: "url", label: "https://github.com/facebook/lexical/tree/main/packages/lexical-react", payload: { href: "https://github.com/facebook/lexical/tree/main/packages/lexical-react" } } },
            ],
            direction: "ltr",
            format: "",
            indent: 0,
            type: "paragraph",
            version: 1,
            textStyle: "",
            textFormat: 0,
          },
        ],
        direction: "ltr",
        format: "",
        indent: 0,
        type: "root",
        version: 1,
      },
    },
  },
  {
    name: "All kinds",
    description: "One pill of every supported kind",
    state: {
      root: {
        children: [
          {
            children: [
              { type: "pill", version: 1, pillData: { kind: "file", label: "README.md", payload: { path: "/README.md" } } },
              { detail: 0, format: 0, mode: "normal", style: "", text: " ", type: "text", version: 1 },
              { type: "pill", version: 1, pillData: { kind: "command", label: "search", payload: { action: "search" } } },
              { detail: 0, format: 0, mode: "normal", style: "", text: " ", type: "text", version: 1 },
              { type: "pill", version: 1, pillData: { kind: "symbol", label: "PillNode", payload: { type: "class" } } },
              { detail: 0, format: 0, mode: "normal", style: "", text: " ", type: "text", version: 1 },
              { type: "pill", version: 1, pillData: { kind: "url", label: "example.com", payload: { href: "https://example.com" } } },
              { detail: 0, format: 0, mode: "normal", style: "", text: " ", type: "text", version: 1 },
              { type: "pill", version: 1, pillData: { kind: "mention", label: "alice", payload: { userId: "u1" } } },
              { detail: 0, format: 0, mode: "normal", style: "", text: " ", type: "text", version: 1 },
              { type: "pill", version: 1, pillData: { kind: "custom", label: "custom-thing", payload: { x: 1, y: 2, nested: { deep: true } } } },
            ],
            direction: "ltr",
            format: "",
            indent: 0,
            type: "paragraph",
            version: 1,
            textStyle: "",
            textFormat: 0,
          },
        ],
        direction: "ltr",
        format: "",
        indent: 0,
        type: "root",
        version: 1,
      },
    },
  },
]

export function DebugPanels({
  editor,
  editorState,
  onLoadScenario,
}: {
  editor: LexicalEditor
  editorState: EditorState | null
  onLoadScenario: (state: object) => void
}) {
  const [activeTab, setActiveTab] = useState<Tab>("tree")

  const tabs: { id: Tab; label: string }[] = [
    { id: "tree", label: "Tree" },
    { id: "json", label: "JSON" },
    { id: "pills", label: "Pills" },
    { id: "segments", label: "Segments" },
    { id: "scenarios", label: "Scenarios" },
  ]

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 border-b border-neutral-200 bg-neutral-50">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 text-[11px] font-medium transition-colors ${
              activeTab === tab.id
                ? "border-b-2 border-neutral-800 text-neutral-800"
                : "text-neutral-400 hover:text-neutral-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-3">
        {activeTab === "tree" && <TreePanel editor={editor} />}
        {activeTab === "json" && <JsonPanel editorState={editorState} />}
        {activeTab === "pills" && <PillsPanel editorState={editorState} />}
        {activeTab === "segments" && <SegmentsPanel editorState={editorState} />}
        {activeTab === "scenarios" && <ScenariosPanel onLoadScenario={onLoadScenario} />}
      </div>
    </div>
  )
}

function TreePanel({ editor }: { editor: LexicalEditor }) {
  return (
    <TreeView
      viewClassName="tree-view-output bg-neutral-50 rounded-md border border-neutral-200 p-3 text-[11px]"
      treeTypeButtonClassName="px-2 py-0.5 text-[10px] rounded border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50 mr-1"
      timeTravelButtonClassName="px-2 py-0.5 text-[10px] rounded border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50 mr-1"
      timeTravelPanelClassName="mt-2 p-2 bg-neutral-50 rounded border border-neutral-200"
      timeTravelPanelSliderClassName="w-full"
      timeTravelPanelButtonClassName="px-2 py-0.5 text-[10px] rounded border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50 mr-1"
      editor={editor}
      customPrintNode={(node) => {
        if (node.__type === "pill") {
          const data = (node as unknown as { __data: PillData }).__data
          return `[pill: ${data.kind}] "${data.label}" ${JSON.stringify(data.payload)}`
        }
        return ""
      }}
    />
  )
}

function JsonPanel({ editorState }: { editorState: EditorState | null }) {
  const json = useMemo(() => {
    if (!editorState) return "null"
    return JSON.stringify(serializeEditorState(editorState), null, 2)
  }, [editorState])

  return (
    <pre className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-[11px] leading-relaxed text-neutral-700 overflow-auto whitespace-pre-wrap break-all">
      {json}
    </pre>
  )
}

function PillsPanel({ editorState }: { editorState: EditorState | null }) {
  const pills = useMemo(() => {
    if (!editorState) return []
    return extractPills(editorState)
  }, [editorState])

  if (pills.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-neutral-400">
        No pills in editor. Type @ or / to insert one.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="text-[11px] font-medium text-neutral-500">
        {pills.length} pill{pills.length !== 1 ? "s" : ""} found
      </div>
      {pills.map((pill, i) => (
        <div key={i} className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
          <div className="mb-2">
            <Pill data={pill} />
          </div>
          <div className="space-y-1 text-[10px] text-neutral-500">
            <div>
              <span className="font-medium text-neutral-600">kind:</span> {pill.kind}
            </div>
            <div>
              <span className="font-medium text-neutral-600">label:</span> {pill.label}
            </div>
            <div>
              <span className="font-medium text-neutral-600">payload:</span>{" "}
              <code className="rounded bg-neutral-100 px-1 py-0.5 text-neutral-600">
                {JSON.stringify(pill.payload)}
              </code>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function SegmentsPanel({ editorState }: { editorState: EditorState | null }) {
  const segments = useMemo(() => {
    if (!editorState) return []
    return extractTextWithPills(editorState)
  }, [editorState])

  if (segments.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-neutral-400">
        Editor is empty.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-medium text-neutral-500">
        {segments.length} segment{segments.length !== 1 ? "s" : ""}
      </div>
      {segments.map((seg, i) => (
        <div
          key={i}
          className={`flex items-start gap-2 rounded-md border p-2 text-[11px] ${
            seg.type === "pill"
              ? "border-blue-200 bg-blue-50/50"
              : "border-neutral-200 bg-neutral-50"
          }`}
        >
          <span
            className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase ${
              seg.type === "pill"
                ? "bg-blue-100 text-blue-600"
                : "bg-neutral-200 text-neutral-500"
            }`}
          >
            {seg.type}
          </span>
          {seg.type === "text" ? (
            <code className="text-neutral-600 whitespace-pre-wrap">
              {JSON.stringify(seg.content)}
            </code>
          ) : (
            <div>
              <Pill data={seg.data} />
              <div className="mt-1 text-[10px] text-neutral-400">
                {JSON.stringify(seg.data.payload)}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function ScenariosPanel({ onLoadScenario }: { onLoadScenario: (state: object) => void }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] text-neutral-500">
        Load a pre-built editor state to test different configurations.
      </div>
      {SCENARIOS.map((scenario) => (
        <button
          key={scenario.name}
          type="button"
          onClick={() => onLoadScenario(scenario.state)}
          className="flex w-full flex-col items-start rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-left transition-colors hover:bg-neutral-100"
        >
          <span className="text-xs font-medium text-neutral-700">
            {scenario.name}
          </span>
          <span className="text-[10px] text-neutral-400">
            {scenario.description}
          </span>
        </button>
      ))}
    </div>
  )
}
