import { nanoid } from "nanoid"

export type PaneNode = {
  id: string
  type: "leaf" | "split"
  orientation?: "horizontal" | "vertical"
  children: string[]
  tabIds: string[]
  activeTabId?: string
  sizes: number[]
}

export type PaneState = {
  panes: PaneNode[]
  rootPaneId: string | null
  focusedPaneId: string | null
}

export function createLeaf(tabIds: string[] = [], activeTabId?: string): PaneNode {
  return {
    id: nanoid(),
    type: "leaf",
    children: [],
    tabIds,
    activeTabId: activeTabId ?? tabIds[0],
    sizes: [50, 50],
  }
}

export function initPaneState(tabIds: string[], activeTabId?: string): PaneState {
  const leaf = createLeaf(tabIds, activeTabId)
  return {
    panes: [leaf],
    rootPaneId: leaf.id,
    focusedPaneId: leaf.id,
  }
}

export function addTabToPane(
  state: PaneState,
  paneId: string,
  tabId: string,
): PaneState {
  return {
    ...state,
    panes: state.panes.map((p) => {
      if (p.id !== paneId || p.type !== "leaf") return p
      const activeIdx = p.activeTabId ? p.tabIds.indexOf(p.activeTabId) : -1
      const insertIdx = activeIdx >= 0 ? activeIdx + 1 : p.tabIds.length
      const newTabIds = [...p.tabIds]
      newTabIds.splice(insertIdx, 0, tabId)
      return { ...p, tabIds: newTabIds, activeTabId: tabId }
    }),
  }
}

export function switchTabInPane(
  state: PaneState,
  paneId: string,
  tabId: string,
): PaneState {
  return {
    ...state,
    focusedPaneId: paneId,
    panes: state.panes.map((p) =>
      p.id === paneId && p.type === "leaf"
        ? { ...p, activeTabId: tabId }
        : p,
    ),
  }
}

export function closeTabInPane(
  state: PaneState,
  paneId: string,
  tabId: string,
): PaneState {
  const pane = state.panes.find((p) => p.id === paneId)
  if (!pane || pane.type !== "leaf") return state

  const nextTabIds = pane.tabIds.filter((id) => id !== tabId)
  if (nextTabIds.length === 0) {
    return { panes: [], rootPaneId: null, focusedPaneId: null }
  }

  const needsNewActive = pane.activeTabId === tabId
  const idx = pane.tabIds.indexOf(tabId)
  const nextActive = needsNewActive
    ? nextTabIds[Math.max(0, idx - 1)]
    : pane.activeTabId

  return {
    ...state,
    panes: state.panes.map((p) =>
      p.id === paneId
        ? { ...p, tabIds: nextTabIds, activeTabId: nextActive }
        : p,
    ),
  }
}
