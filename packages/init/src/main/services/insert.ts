import * as Effect from "effect/Effect";
import { nanoid } from "nanoid";
import { Service, runtime } from "../runtime";
import { DbService } from "./db";
import { RpcService } from "./rpc";
import {
  findLiveSessionTab,
  findAgentIdForSession,
} from "../../../shared/agent-ops";
import { appendTokenToEditorState } from "../../../shared/editor-state";
import type { TokenPayload } from "../../../shared/tokens";

export type InsertTokenResult = {
  delivered: "live" | "persisted";
  requestId?: string;
};

/**
 * Core-owned RPC entry point for "insert this token into that session's
 * composer". Called by plugin callers (e.g. file-manager picker mode),
 * agents, the CLI — any code that has a sessionId + payload.
 *
 * Two paths, split by whether the session is the active tab of the focused
 * pane of the focused window:
 *
 *  - Live: emit `insert.requested` via zenrpc. The focused composer's
 *    InsertBridgePlugin picks it up and hands it to the token-bus, which
 *    mutates the Lexical editor.
 *  - Not live (backgrounded tab / non-focused window / not mounted): write
 *    the TokenNode directly into the session's persisted draft. On next
 *    mount OR on refocus, the composer rehydrates from that draft and the
 *    pill appears.
 *
 * TODO(crdt): This split exists only because we don't have a merge protocol
 * for two writers mutating editor state concurrently. With a CRDT we could
 * apply to any mounted composer and merge with local edits.
 */
export class InsertService extends Service {
  static key = "insert";
  static deps = { db: DbService, rpc: RpcService };
  declare ctx: { db: DbService; rpc: RpcService };

  async insertToken(args: {
    sessionId: string;
    payload: TokenPayload;
  }): Promise<InsertTokenResult> {
    const client = this.ctx.db.effectClient;
    const kernel = client.readRoot().plugin.kernel;

    const live = findLiveSessionTab(kernel, args.sessionId);
    if (live) {
      const agentId = findAgentIdForSession(
        kernel.windowStates,
        args.sessionId,
      );
      const requestId = nanoid();
      this.ctx.rpc.emit.insert.requested({
        requestId,
        windowId: live.windowId,
        sessionId: args.sessionId,
        agentId: agentId ?? "",
        payload: args.payload,
        ts: Date.now(),
      });
      return { delivered: "live", requestId };
    }

    const agentId = findAgentIdForSession(kernel.windowStates, args.sessionId);
    if (!agentId) {
      // No such session. Caller gave us a stale id — fail quietly; there's
      // no UI to surface it on.
      console.warn(`[insert] insertToken: unknown sessionId ${args.sessionId}`);
      return { delivered: "persisted" };
    }

    // TODO(crdt): Keyed by agentId today (matches DraftPersistencePlugin);
    // when we migrate to sessionId keys (plan Phase 7), swap this key.
    const draftKey = agentId;

    await Effect.runPromise(
      client.update((root) => {
        const drafts = root.plugin.kernel.composerDrafts ?? {};
        const existing = drafts[draftKey];
        const nextEditorState = appendTokenToEditorState(
          existing?.editorState,
          args.payload,
        );
        const nextBlobs = [
          ...(existing?.chatBlobs ?? []),
          ...(args.payload.blobs ?? []).map((b) => ({
            blobId: b.blobId,
            mimeType: b.mimeType,
          })),
        ];
        root.plugin.kernel.composerDrafts = {
          ...drafts,
          [draftKey]: {
            editorState: nextEditorState as any,
            chatBlobs: nextBlobs,
          },
        };
      }),
    ).catch((err) => {
      console.error("[insert] persist failed:", err);
    });

    return { delivered: "persisted" };
  }

  /**
   * Agent-keyed insert — no session needed. Intended for callers that
   * target a brand-new agent (e.g., the quick-chat plugin creates a cursor
   * agent before any session/tab wraps it). Always writes to the persisted
   * draft so the composer picks the token up at mount time.
   *
   * If the agent also happens to have a live session, that composer is
   * already listening for draft changes via the refocus-rehydrate flow;
   * there's no benefit to the "live event" fast path here and plenty of
   * simplicity to gain by staying single-path.
   */
  async insertTokenForAgent(args: {
    agentId: string;
    payload: TokenPayload;
  }): Promise<{ ok: boolean }> {
    const client = this.ctx.db.effectClient;
    await Effect.runPromise(
      client.update((root) => {
        const drafts = root.plugin.kernel.composerDrafts ?? {};
        const existing = drafts[args.agentId];
        const nextEditorState = appendTokenToEditorState(
          existing?.editorState,
          args.payload,
        );
        const nextBlobs = [
          ...(existing?.chatBlobs ?? []),
          ...(args.payload.blobs ?? []).map((b) => ({
            blobId: b.blobId,
            mimeType: b.mimeType,
          })),
        ];
        root.plugin.kernel.composerDrafts = {
          ...drafts,
          [args.agentId]: {
            editorState: nextEditorState as any,
            chatBlobs: nextBlobs,
          },
        };
      }),
    ).catch((err) => {
      console.error("[insert] insertTokenForAgent persist failed:", err);
      return { ok: false };
    });
    return { ok: true };
  }

  evaluate() {
    console.log("[insert] service ready");
  }
}

runtime.register(InsertService, (import.meta as any).hot);
