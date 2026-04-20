import type { TokenPayload } from "../../../../../shared/tokens"

/**
 * Window-scoped insert channel. Any code in the chat iframe can dispatch a
 * token-insert intent; the `TokenInsertPlugin` (inside the Composer) is the
 * authoritative subscriber that turns it into a Lexical mutation.
 *
 * We stay with a CustomEvent rather than a React context because this bus
 * needs to reach the Composer from sibling contexts (modal-in-portal,
 * orchestrator-level bridge, devtools) without prop-drilling.
 */

export const TOKEN_INSERT_EVENT = "zenbu-composer:insert-token"

export type TokenInsertSource = "file-picker" | "paste" | "rpc" | "debug"

export type TokenInsertDetail = {
  sessionId: string
  agentId: string
  payload: TokenPayload
  source: TokenInsertSource
  /**
   * Opaque correlation id. When the same token is inserted and then later
   * upgraded (e.g. image upload finishes, file content finishes loading),
   * reuse the same `localId` so the plugin can find-and-replace in place.
   */
  localId?: string
}

export function dispatchTokenInsert(detail: TokenInsertDetail): void {
  window.dispatchEvent(new CustomEvent(TOKEN_INSERT_EVENT, { detail }))
}

export function subscribeTokenInsert(
  cb: (detail: TokenInsertDetail) => void,
): () => void {
  const handler = (e: Event) => {
    const d = (e as CustomEvent<TokenInsertDetail>).detail
    if (!d) return
    cb(d)
  }
  window.addEventListener(TOKEN_INSERT_EVENT, handler)
  return () => window.removeEventListener(TOKEN_INSERT_EVENT, handler)
}

/**
 * Upgrade intent for an existing token (e.g. replace an "uploading" image
 * pill with the final blob). Separate event to keep the "insert fresh pill"
 * API simple — subscribers that only care about inserts don't need to
 * filter upgrades out.
 */
export const TOKEN_UPGRADE_EVENT = "zenbu-composer:upgrade-token"

export type TokenUpgradeDetail = {
  sessionId: string
  agentId: string
  localId: string
  payload: TokenPayload
}

export function dispatchTokenUpgrade(detail: TokenUpgradeDetail): void {
  window.dispatchEvent(new CustomEvent(TOKEN_UPGRADE_EVENT, { detail }))
}

export function subscribeTokenUpgrade(
  cb: (detail: TokenUpgradeDetail) => void,
): () => void {
  const handler = (e: Event) => {
    const d = (e as CustomEvent<TokenUpgradeDetail>).detail
    if (!d) return
    cb(d)
  }
  window.addEventListener(TOKEN_UPGRADE_EVENT, handler)
  return () => window.removeEventListener(TOKEN_UPGRADE_EVENT, handler)
}
