/**
 * Tree-shaking shim for `lucide-react`.
 *
 * In Vite dev, `optimizeDeps` pre-bundles `lucide-react` as a single chunk
 * (~1.1MB) regardless of which icons consumers use. Even though lucide
 * declares `sideEffects: false`, esbuild can't tree-shake when entering
 * through the barrel.
 *
 * This shim re-exports ONLY the icons we actually use, sourced from
 * `lucide-react/dist/esm/icons/<kebab>.js`. The Vite alias config maps
 * `lucide-react` → this file (regex-anchored so `lucide-react/...` deep
 * paths still resolve normally).
 *
 * To add an icon: add a new line below. Keep alphabetical for diff sanity.
 * To find the kebab path: it's the icon name lowercased with `-` between
 * words (e.g. `RotateCcwIcon` → `rotate-ccw`, `Trash2Icon` → `trash-2`).
 */
export { default as ArrowDownIcon } from "lucide-react/dist/esm/icons/arrow-down.js"
export { default as ArrowDownUpIcon } from "lucide-react/dist/esm/icons/arrow-down-up.js"
export { default as ArrowLeftIcon } from "lucide-react/dist/esm/icons/arrow-left.js"
export { default as CheckIcon } from "lucide-react/dist/esm/icons/check.js"
export { default as ChevronDownIcon } from "lucide-react/dist/esm/icons/chevron-down.js"
export { default as ChevronRightIcon } from "lucide-react/dist/esm/icons/chevron-right.js"
export { default as ChevronUpIcon } from "lucide-react/dist/esm/icons/chevron-up.js"
export { default as CopyIcon } from "lucide-react/dist/esm/icons/copy.js"
export { default as DownloadCloudIcon } from "lucide-react/dist/esm/icons/download-cloud.js"
export { default as DownloadIcon } from "lucide-react/dist/esm/icons/download.js"
export { default as ExternalLinkIcon } from "lucide-react/dist/esm/icons/external-link.js"
export { default as FolderOpenIcon } from "lucide-react/dist/esm/icons/folder-open.js"
export { default as FolderSyncIcon } from "lucide-react/dist/esm/icons/folder-sync.js"
export { default as GitMergeIcon } from "lucide-react/dist/esm/icons/git-merge.js"
export { default as MessageSquarePlusIcon } from "lucide-react/dist/esm/icons/message-square-plus.js"
export { default as PencilIcon } from "lucide-react/dist/esm/icons/pencil.js"
export { default as PencilLineIcon } from "lucide-react/dist/esm/icons/pencil-line.js"
export { default as RefreshCwIcon } from "lucide-react/dist/esm/icons/refresh-cw.js"
export { default as RotateCcwIcon } from "lucide-react/dist/esm/icons/rotate-ccw.js"
export { default as RotateCwIcon } from "lucide-react/dist/esm/icons/rotate-cw.js"
export { default as SearchIcon } from "lucide-react/dist/esm/icons/search.js"
export { default as SettingsIcon } from "lucide-react/dist/esm/icons/settings.js"
export { default as ShieldCheckIcon } from "lucide-react/dist/esm/icons/shield-check.js"
export { default as StarIcon } from "lucide-react/dist/esm/icons/star.js"
export { default as Trash2Icon } from "lucide-react/dist/esm/icons/trash-2.js"
export { default as XIcon } from "lucide-react/dist/esm/icons/x.js"
