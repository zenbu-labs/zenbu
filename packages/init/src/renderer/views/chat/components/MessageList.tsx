import { useCallback, useRef, useState, useLayoutEffect, forwardRef, useImperativeHandle } from "react"
import { ArrowDownIcon } from "lucide-react"
import type { MaterializedMessage } from "../lib/materialize"
import type { ChatComponents } from "../lib/chat-components"
import { useAutoScroll, type ScrollSnapshot } from "../lib/use-auto-scroll"
import { readChatScrollMetrics } from "../lib/scroll-metrics"
import { TurnSummary } from "./TurnSummary"
import {
  reportChatInvariant,
  summarizeMessage,
  type ExpectedVisibleMessage,
} from "../lib/chat-invariants"

export type ScrollMetrics = {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
  clientWidth: number
}

export type MessageListHandle = {
  firstVisibleIndex: () => number | null
  exportMeasurementCache: () => Record<string, any>
  isLockedToBottom: boolean
  getScrollMetrics: () => ScrollMetrics | null
  markBottomRevealIntent: (source: string) => void
  scrollTo: (scrollTop: number) => void
  getScrollElement: () => HTMLDivElement | null
  forceScrollToBottom: () => void
}

export type MessageListProps = {
  messages: MaterializedMessage[]
  loading: boolean
  components: ChatComponents
  debugExpectedVisibleMessageRef?: React.MutableRefObject<ExpectedVisibleMessage | null>
  initialMeasurementCache?: Record<string, any>
  scrollToIndexOnMount?: number
  onPermissionSelect?: (toolCallId: string, optionId: string) => void
  onQuestionSubmit?: (toolCallId: string, answer: string) => void
  onScrollMetrics?: (metrics: ScrollMetrics) => void
  hasMoreAbove?: boolean
  hasMoreBelow?: boolean
  loadingMore?: boolean
  onLoadOlder?: (captureSnapshot: () => ScrollSnapshot | null) => void
  onLoadNewer?: () => void
  onDetachedFromBottom?: () => void
  onReachedBottom?: () => void
}

function getMessageKey(msg: MaterializedMessage, index: number): string {
  if (msg.key) return msg.key
  switch (msg.role) {
    case "tool":
    case "permission_request":
      return msg.toolCallId
    case "ask_question":
      return msg.toolCallId
    case "plan":
      return `plan-${index}`
    default:
      return `${msg.role}-${index}`
  }
}

const MIN_LOAD_OLDER_THRESHOLD = 400
const LOAD_OLDER_THRESHOLD_MULTIPLIER = 1.5
const LOAD_NEWER_THRESHOLD = 200
const INVARIANT_BOTTOM_DRIFT_THRESHOLD = 24

function getLoadOlderThreshold(el: HTMLElement) {
  return Math.max(
    MIN_LOAD_OLDER_THRESHOLD,
    Math.round(el.clientHeight * LOAD_OLDER_THRESHOLD_MULTIPLIER),
  )
}

export const MessageList = forwardRef<MessageListHandle, MessageListProps>(
  function MessageList(
    {
      messages,
      loading,
      components: C,
      debugExpectedVisibleMessageRef,
      onPermissionSelect,
      onQuestionSubmit,
      onScrollMetrics,
      hasMoreAbove,
      hasMoreBelow,
      onLoadOlder,
      onLoadNewer,
      onDetachedFromBottom,
      onReachedBottom,
    },
    ref,
  ) {
    const autoScroll = useAutoScroll({
      working: !!loading,
      canLockToBottom: !hasMoreBelow,
      onUserScrolled: onDetachedFromBottom,
    })
    const initialScrollDoneRef = useRef(false)
    const pendingSnapshotRef = useRef<ScrollSnapshot | null>(null)
    const loadOlderInFlightRef = useRef(false)
    const [showScrollToBottom, setShowScrollToBottom] = useState(false)
    const clickedScrollToBottomRef = useRef(false)
    const lastInvariantCommitKeyRef = useRef<string | null>(null)
    const bottomRevealIntentRef = useRef<{
      requestedAt: number
      source: string
      expectedTimestamp: number | null
    } | null>(null)
    const [bottomRevealIntentSeq, setBottomRevealIntentSeq] = useState(0)

    const markBottomRevealIntent = useCallback((source: string) => {
      bottomRevealIntentRef.current = {
        requestedAt: Date.now(),
        source,
        expectedTimestamp:
          debugExpectedVisibleMessageRef?.current?.timestamp ?? null,
      }
      setBottomRevealIntentSeq((seq) => seq + 1)
    }, [debugExpectedVisibleMessageRef])

    const emitScrollMetrics = useCallback(() => {
      const el = autoScroll.getScrollElement()
      if (!el || !onScrollMetrics) return
      onScrollMetrics({
        scrollTop: el.scrollTop,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        clientWidth: el.clientWidth,
      })
    }, [onScrollMetrics, autoScroll])

    const handleScroll = useCallback(() => {
      const el = autoScroll.getScrollElement()
      if (!el) return

      const wasUserScrolled = autoScroll.userScrolled
      const distanceFromBottom = el.scrollHeight - el.clientHeight - el.scrollTop
      const loadOlderThreshold = getLoadOlderThreshold(el)

      if (hasMoreBelow && wasUserScrolled && distanceFromBottom < LOAD_NEWER_THRESHOLD) {
        onLoadNewer?.()
        emitScrollMetrics()
        return
      }

      autoScroll.handleScroll()
      emitScrollMetrics()

      const isUserScrolled = autoScroll.userScrolled

      if (!isUserScrolled) {
        loadOlderInFlightRef.current = false
      }

      if (
        hasMoreAbove &&
        onLoadOlder &&
        isUserScrolled &&
        !loadOlderInFlightRef.current &&
        el.scrollTop < loadOlderThreshold
      ) {
        const capture = () => {
          loadOlderInFlightRef.current = true
          const snap = autoScroll.captureSnapshot()
          if (snap) pendingSnapshotRef.current = snap
          return snap
        }
        onLoadOlder(capture)
      }

      if (wasUserScrolled && !isUserScrolled && !hasMoreBelow) {
        onReachedBottom?.()
      }

      const shouldShow = distanceFromBottom > 4
      if (shouldShow) clickedScrollToBottomRef.current = false
      setShowScrollToBottom(shouldShow)
    }, [autoScroll, emitScrollMetrics, hasMoreAbove, hasMoreBelow, messages.length, onLoadNewer, onLoadOlder, onReachedBottom])

    useLayoutEffect(() => {
      const el = autoScroll.getScrollElement()
      if (!el) return

      const distanceFromBottom = el.scrollHeight - el.clientHeight - el.scrollTop
      if (distanceFromBottom > LOAD_NEWER_THRESHOLD) return

      if (hasMoreBelow) {
        if (autoScroll.userScrolled) {
          onLoadNewer?.()
        } else {
          onReachedBottom?.()
        }
        return
      }

      if (autoScroll.userScrolled && distanceFromBottom <= 4) {
        onReachedBottom?.()
      }
    }, [autoScroll, hasMoreBelow, messages.length, onLoadNewer, onReachedBottom])

    useLayoutEffect(() => {
      if (pendingSnapshotRef.current) return
      if (autoScroll.userScrolled) return
      autoScroll.forceScrollToBottom()
    }, [autoScroll, messages])

    useLayoutEffect(() => {
      const expectedRef = debugExpectedVisibleMessageRef
      if (expectedRef?.current && Date.now() - expectedRef.current.createdAt > 5000) {
        expectedRef.current = null
      }

      const commitKey = [
        messages.length,
        messages[messages.length - 1]?.key ?? "none",
        hasMoreBelow ? "hidden-below" : "tail-visible",
        autoScroll.userScrolled ? "detached" : "locked",
      ].join(":")

      if (lastInvariantCommitKeyRef.current === commitKey) return
      lastInvariantCommitKeyRef.current = commitKey

      let raf1 = 0
      let raf2 = 0

      const inspect = () => {
        const el = autoScroll.getScrollElement()
        if (!el) return

        const metrics = readChatScrollMetrics(el)
        const distanceFromBottom = metrics?.distanceFromBottom ?? null
        const expected = expectedRef?.current ?? null
        const expectedRendered = expected
          ? messages.some(
              (message) =>
                message.role === "user" &&
                message.timeSent === expected.timestamp,
            )
          : false
        const lastMessage = messages[messages.length - 1]
        const details = {
          messageCount: messages.length,
          loading,
          hasMoreAbove: !!hasMoreAbove,
          hasMoreBelow: !!hasMoreBelow,
          scrollMetrics: metrics,
          userScrolled: autoScroll.userScrolled,
          autoScroll: autoScroll.getDebugState?.() ?? null,
          lastMessage: summarizeMessage(lastMessage),
          expectedVisibleMessage: expected,
        }

        if (
          !autoScroll.userScrolled &&
          hasMoreBelow &&
          distanceFromBottom !== null &&
          distanceFromBottom <= LOAD_NEWER_THRESHOLD
        ) {
          reportChatInvariant(
            "LOCKED_WITH_HIDDEN_TAIL",
            details,
            `locked-hidden-tail:${lastMessage?.key ?? "none"}:${messages.length}`,
          )
        }

        if (
          !autoScroll.userScrolled &&
          distanceFromBottom !== null &&
          distanceFromBottom > INVARIANT_BOTTOM_DRIFT_THRESHOLD
        ) {
          reportChatInvariant(
            "LOCKED_COMMIT_NOT_AT_BOTTOM",
            details,
            `locked-drift:${lastMessage?.key ?? "none"}:${messages.length}`,
          )
        }

        if (!expected || !expectedRef) return

        if (!expectedRendered) {
          reportChatInvariant(
            "LOCAL_SUBMIT_NOT_PRESENT_IN_RENDERED_MESSAGES",
            details,
            `submit-missing:${expected.timestamp}`,
          )
          return
        }

        if (autoScroll.userScrolled) {
          reportChatInvariant(
            "LOCAL_SUBMIT_RENDERED_BUT_AUTOSCROLL_DETACHED",
            details,
            `submit-detached:${expected.timestamp}`,
          )
          return
        }

        if (
          distanceFromBottom !== null &&
          distanceFromBottom > INVARIANT_BOTTOM_DRIFT_THRESHOLD
        ) {
          reportChatInvariant(
            "LOCAL_SUBMIT_RENDERED_BUT_HIDDEN_BELOW_VIEWPORT",
            details,
            `submit-hidden:${expected.timestamp}`,
          )
          return
        }

        expectedRef.current = null
      }

      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(inspect)
      })

      return () => {
        if (raf1) cancelAnimationFrame(raf1)
        if (raf2) cancelAnimationFrame(raf2)
      }
    }, [
      autoScroll,
      debugExpectedVisibleMessageRef,
      hasMoreAbove,
      hasMoreBelow,
      loading,
      messages,
    ])

    useLayoutEffect(() => {
      const intent = bottomRevealIntentRef.current
      if (!intent) return

      let raf1 = 0
      let raf2 = 0

      const inspect = () => {
        const currentIntent = bottomRevealIntentRef.current
        if (!currentIntent || currentIntent.requestedAt !== intent.requestedAt) return

        const el = autoScroll.getScrollElement()
        if (!el) return

        const metrics = readChatScrollMetrics(el)
        const distanceFromBottom = metrics?.distanceFromBottom ?? null
        const expectedRendered = intent.expectedTimestamp !== null
          ? messages.some(
              (message) =>
                message.role === "user" &&
                message.timeSent === intent.expectedTimestamp,
            )
          : null
        const lastMessage = messages[messages.length - 1]
        const details = {
          source: intent.source,
          requestedAt: intent.requestedAt,
          expectedTimestamp: intent.expectedTimestamp,
          expectedRendered,
          messageCount: messages.length,
          loading,
          hasMoreAbove: !!hasMoreAbove,
          hasMoreBelow: !!hasMoreBelow,
          scrollMetrics: metrics,
          userScrolled: autoScroll.userScrolled,
          autoScroll: autoScroll.getDebugState?.() ?? null,
          lastMessage: summarizeMessage(lastMessage),
          expectedVisibleMessage: debugExpectedVisibleMessageRef?.current ?? null,
        }

        if (autoScroll.userScrolled) {
          reportChatInvariant(
            "EXPLICIT_BOTTOM_REQUEST_LEFT_AUTOSCROLL_DETACHED",
            details,
            `bottom-request-detached:${intent.source}:${intent.requestedAt}`,
          )
        } else if (
          hasMoreBelow &&
          distanceFromBottom !== null &&
          distanceFromBottom <= LOAD_NEWER_THRESHOLD
        ) {
          reportChatInvariant(
            "EXPLICIT_BOTTOM_REQUEST_STILL_HAS_HIDDEN_TAIL",
            details,
            `bottom-request-hidden-tail:${intent.source}:${intent.requestedAt}`,
          )
        } else if (intent.expectedTimestamp !== null && expectedRendered === false) {
          reportChatInvariant(
            "EXPLICIT_BOTTOM_REQUEST_DID_NOT_REVEAL_EXPECTED_SUBMIT",
            details,
            `bottom-request-missing-submit:${intent.source}:${intent.requestedAt}`,
          )
        } else if (
          intent.expectedTimestamp !== null &&
          distanceFromBottom !== null &&
          distanceFromBottom > INVARIANT_BOTTOM_DRIFT_THRESHOLD
        ) {
          reportChatInvariant(
            "EXPLICIT_BOTTOM_REQUEST_REACHED_WRONG_VIEWPORT",
            details,
            `bottom-request-wrong-viewport:${intent.source}:${intent.requestedAt}`,
          )
        }

        if (
          bottomRevealIntentRef.current?.requestedAt === intent.requestedAt
        ) {
          bottomRevealIntentRef.current = null
        }
      }

      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(inspect)
      })

      return () => {
        if (raf1) cancelAnimationFrame(raf1)
        if (raf2) cancelAnimationFrame(raf2)
      }
    }, [
      autoScroll,
      bottomRevealIntentSeq,
      debugExpectedVisibleMessageRef,
      hasMoreAbove,
      hasMoreBelow,
      loading,
      messages,
    ])

    useLayoutEffect(() => {
      if (initialScrollDoneRef.current) return
      if (messages.length === 0) return
      const el = autoScroll.getScrollElement()
      if (!el) return
      el.scrollTop = el.scrollHeight
      initialScrollDoneRef.current = true
    }, [messages.length, autoScroll])

    // Restore scroll position after React commits prepended content.
    // This fires synchronously after DOM update, before paint.
    useLayoutEffect(() => {
      const snapshot = pendingSnapshotRef.current
      if (!snapshot) return
      pendingSnapshotRef.current = null
      autoScroll.restoreSnapshot(snapshot)
      loadOlderInFlightRef.current = false
    }, [messages, autoScroll])

    useImperativeHandle(ref, () => ({
      firstVisibleIndex: () => 0,
      exportMeasurementCache: () => ({}),
      get isLockedToBottom() { return !autoScroll.userScrolled },
      getScrollMetrics: () => {
        const el = autoScroll.getScrollElement()
        if (!el) return null
        return { scrollTop: el.scrollTop, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, clientWidth: el.clientWidth }
      },
      markBottomRevealIntent,
      scrollTo: (scrollTop: number) => {
        const el = autoScroll.getScrollElement()
        if (el) el.scrollTop = scrollTop
      },
      getScrollElement: () => autoScroll.getScrollElement(),
      forceScrollToBottom: () => autoScroll.forceScrollToBottom(),
    }), [autoScroll, markBottomRevealIntent])

    const isEmpty = messages.length === 0 && !loading

    return (
      <div
        className={`min-h-0 flex-1 relative flex flex-col ${C.containerClassName}`}
      >
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-400 text-sm">
          </div>
        )}

        <div
          ref={autoScroll.scrollRef}
          onScroll={handleScroll}
          onClick={autoScroll.handleInteraction}
          className={`min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-1 [scrollbar-width:none] ${
            autoScroll.userScrolled
              ? "hover:[scrollbar-width:thin] hover:[scrollbar-color:var(--color-neutral-300)_transparent]"
              : ""
          }`}
          style={{ overflowX: "hidden" }}
        >
          <div
            ref={autoScroll.contentRef}
            className="mx-auto w-full max-w-[919px] space-y-1.5 px-5"
          >
            {hasMoreAbove && (
              <div className="flex justify-center py-2">
                <span className="text-neutral-400 text-xs animate-pulse">Loading...</span>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={getMessageKey(msg, i)}>
                <MessageRow
                  message={msg}
                  components={C}
                  onPermissionSelect={onPermissionSelect}
                  onQuestionSubmit={onQuestionSubmit}
                />
              </div>
            ))}

            <div className={`shrink-0 ${loading ? "h-9" : "min-h-9 pb-4"}`}>
              {loading ? (
                <C.Loading messages={messages} />
              ) : (
                messages.length > 0 ? (
                  <div className="px-3"><TurnSummary messages={messages} isLockedToBottom={!autoScroll.userScrolled} scrollToBottom={() => autoScroll.forceScrollToBottom()} /></div>
                ) : null
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            clickedScrollToBottomRef.current = true
            setShowScrollToBottom(false)
            markBottomRevealIntent("scroll-button")
            onReachedBottom?.()
            autoScroll.forceScrollToBottom()
          }}
          className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center size-8 rounded-lg border border-neutral-300 bg-white text-neutral-500 shadow-md hover:bg-neutral-50 hover:text-neutral-700 cursor-pointer ${showScrollToBottom ? "opacity-100 translate-y-0 scale-100 transition-all duration-200 ease-out" : `opacity-0 translate-y-2 scale-90 pointer-events-none ${clickedScrollToBottomRef.current ? "duration-0" : "transition-all duration-200 ease-out"}`}`}
        >
          <ArrowDownIcon className="size-4" />
        </button>
      </div>
    )
  },
)

function MessageRow({
  message: msg,
  components: C,
  onPermissionSelect,
  onQuestionSubmit,
}: {
  message: MaterializedMessage
  components: ChatComponents
  onPermissionSelect?: (toolCallId: string, optionId: string) => void
  onQuestionSubmit?: (toolCallId: string, answer: string) => void
}) {
  switch (msg.role) {
    case "user":
      return <C.UserMessage content={msg.content} images={msg.images} />
    case "assistant":
      return <C.AssistantMessage content={msg.content} />
    case "thinking":
      return <C.ThinkingBlock content={msg.content} />
    case "tool":
      return (
        <C.ToolCall
          toolCallId={msg.toolCallId}
          title={msg.title}
          subtitle={msg.subtitle}
          kind={msg.kind}
          status={msg.status}
          contentItems={msg.contentItems}
          rawOutput={msg.rawOutput}
          rawInput={msg.rawInput}
          toolName={msg.toolName}
          toolResponse={msg.toolResponse}
          children={msg.children}
        />
      )
    case "plan":
      return <C.Plan entries={msg.entries} />
    case "permission_request":
      return (
        <C.PermissionRequest
          toolCallId={msg.toolCallId}
          title={msg.title}
          kind={msg.kind}
          description={msg.description}
          options={msg.options}
          onSelect={(optionId) =>
            onPermissionSelect?.(msg.toolCallId, optionId)
          }
        />
      )
    case "ask_question":
      return (
        <C.AskQuestion
          toolCallId={msg.toolCallId}
          question={msg.question}
          onSubmit={(answer) => onQuestionSubmit?.(msg.toolCallId, answer)}
        />
      )
    case "interrupted":
      return <C.Interrupted />
    case "auth_event":
      return <C.AuthEvent status={msg.status} authMethods={msg.authMethods} />
  }
}
