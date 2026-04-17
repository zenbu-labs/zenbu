# View Manager Specification

The view manager controls how views are spatially arranged in the window. Views are rendered as iframes. The window has a title bar, a tab bar, and a content area.

## Layout

The content area displays one or more views in a grid of panes. A pane always shows exactly one view.

When there is only one pane, it fills the entire content area. When there are multiple panes, they are arranged by recursive horizontal or vertical splits, each split dividing the space 50/50.

## Tabs

Every view has a tab. Where that tab appears depends on whether the view is currently visible in a pane:

- **Unsplit mode** (single pane): All tabs appear in the tab bar. The currently displayed view's tab is highlighted.
- **Split mode** (multiple panes): Each pane has its own small title bar showing the view name. Only views NOT currently in a pane appear in the top tab bar -- it acts as a shelf of available views.

Clicking a tab in the tab bar shows that view in the focused pane. The previously shown view goes back to the shelf (in split mode) or simply deactivates (in unsplit mode).

The + button creates a new view and shows it in the focused pane.

The x on a tab permanently deletes that view.

## Splitting

You can split the content area by dragging a tab from the tab bar onto a pane.

As you drag over a pane, the system detects which edge of the pane is closest to the cursor: left, right, top, or bottom.

- Left or right: the pane will split horizontally (side by side)
- Top or bottom: the pane will split vertically (stacked)

The dragged view goes on the side the cursor is nearest to. For example, dragging to the right edge puts the new view on the right and the existing view on the left.

During the drag:
- The pane being hovered smoothly shrinks to half its size
- A blue highlighted area appears in the other half, showing where the new view will land
- This animation should be smooth (not instant)

On drop, the split is committed and both views render in their respective panes.

Splits can nest arbitrarily. After a horizontal split, you can split one of the resulting panes vertically, creating an L-shaped layout. You can keep splitting to create any grid arrangement.

## Swapping

When the layout is already split, you can rearrange panes by dragging a pane's title bar onto another pane.

This swaps the two views -- they exchange positions. The layout structure does not change, only which view is in which pane.

During the drag:
- The target pane dims slightly and shows a blue overlay, indicating a swap (not a new split)
- This is visually distinct from the split preview

## Unsplitting

Each pane's title bar has an x button. Clicking it removes that pane from the layout. The remaining sibling expands to fill the space.

If unsplitting leaves only one pane remaining, the pane title bar disappears and the view returns to unsplit mode.

The removed view is not destroyed. It stays alive in the background and its tab reappears in the shelf.

## Focus

One pane is always "focused." This is indicated by a slightly different title bar appearance. Clicking inside a pane focuses it. Focus determines which pane gets replaced when you click a tab in the shelf or create a new tab.

## Background Views

Views not currently shown in any pane stay alive in the background. Their state (scroll position, form inputs, WebSocket connections) is preserved. When you bring a view back into a pane (by clicking its tab or dragging it), it appears instantly without reloading.

## Process Isolation

Each view runs in its own operating system process. If one view freezes or crashes, the other views and the orchestrator remain responsive. The orchestrator can detect and recover from a frozen view.

## Drag Behavior Details

Dragging uses pointer capture, not native HTML drag-and-drop. This is because iframes block native drag events.

A drag starts after moving the pointer more than 4 pixels from the initial press point. Before that threshold, it's treated as a click.

A small floating label follows the cursor during a drag, showing the name of the view being dragged.

If the cursor leaves all panes during a drag, the preview clears and all panes return to their normal size.

Releasing the pointer commits the operation. If there's no valid target, nothing happens.

## Animations

All layout transitions should animate smoothly:

- Pane resizing during drag preview: the pane smoothly shrinks to make room for the preview area
- Dropping a split: the two panes settle into their final positions
- Unsplitting: the remaining pane smoothly expands to fill the space
- Swap preview: the target pane smoothly dims and un-dims

Nothing should snap or jump. Every geometric change should transition.
