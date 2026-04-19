import { useMemo, useCallback, useRef, useState } from "react";
import { useCollection, useDb } from "../../lib/kyju-react";
import { useKyjuClient } from "../../lib/providers";
import { MessageList } from "./components/MessageList";
import type {
  MessageListHandle,
  ScrollMetrics,
} from "./components/MessageList";
import { Minimap } from "./components/Minimap";
import { FindInChat } from "./components/FindInChat";
import { materializeMessages } from "./lib/materialize";
import { standardComponents } from "./components/modes/standard";
import { useWindowedItems } from "./lib/use-chat-events";
import type { ExpectedVisibleMessage } from "./lib/chat-invariants";

export type ChatDisplayProps = {
  agentId: string;
  scrollToBottomRef?: React.MutableRefObject<(() => void) | null>;
  debugExpectedVisibleMessageRef?: React.MutableRefObject<ExpectedVisibleMessage | null>;
};

export function ChatDisplay({
  agentId,
  scrollToBottomRef,
  debugExpectedVisibleMessageRef,
}: ChatDisplayProps) {
  const agent = useDb((root) =>
    root.plugin.kernel.agents.find((a) => a.id === agentId),
  );
  const client = useKyjuClient();
  const streaming = agent?.status === "streaming";
  const { items: allEvents } = useCollection(agent?.eventLog);

  /**
   * Permission-prompt response: user clicked a button (or cancelled).
   * Writes a `permission_response` event into the agent's eventLog, which
   * the agent process's subscription picks up and feeds back to ACP.
   * No RPC needed — the event log IS the bus.
   */
  const handlePermissionSelect = useCallback(
    async (requestId: string, optionId: string | "__cancel__") => {
      const agentNode = client.plugin.kernel.agents
        .read()
        .find((a) => a.id === agentId);
      if (!agentNode?.eventLog) return;
      const collectionRef = client.plugin.kernel.agents
        .read()
        .findIndex((a) => a.id === agentId);
      if (collectionRef < 0) return;
      const outcome =
        optionId === "__cancel__"
          ? ({ outcome: "cancelled" as const })
          : ({ outcome: "selected" as const, optionId });
      await client.plugin.kernel.agents[collectionRef].eventLog
        .concat([
          {
            timestamp: Date.now(),
            data: {
              kind: "permission_response",
              requestId,
              outcome,
            },
          },
        ])
        .catch(() => {});
    },
    [client, agentId],
  );
  const allMessages = useMemo(
    () => materializeMessages(allEvents as any),
    [allEvents],
  );

  const {
    items: messages,
    hasMoreBefore,
    hasMoreAfter,
    loadOlder,
    loadNewer,
    freezeTail,
    resumeTail,
  } = useWindowedItems({
    items: allMessages,
    initialWindow: 50,
    batchSize: 50,
  });
  const listRef = useRef<MessageListHandle>(null);
  const [scrollMetrics, setScrollMetrics] = useState<ScrollMetrics | null>(
    null,
  );

  if (scrollToBottomRef) {
    scrollToBottomRef.current = () => {
      listRef.current?.markBottomRevealIntent("composer-scroll");
      resumeTail();
      listRef.current?.forceScrollToBottom();
    };
  }

  const scrollElRef = useMemo<React.RefObject<HTMLDivElement | null>>(
    () => ({
      get current() {
        return listRef.current?.getScrollElement() ?? null;
      },
      set current(_) {},
    }),
    [],
  );

  const handleScrollTo = useCallback((scrollTop: number) => {
    listRef.current?.scrollTo(scrollTop);
  }, []);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col relative">
      <FindInChat scrollRef={scrollElRef} contentVersion={messages.length} />
      <MessageList
        ref={listRef}
        messages={messages}
        loading={streaming}
        components={standardComponents}
        onScrollMetrics={setScrollMetrics}
        hasMoreAbove={hasMoreBefore}
        hasMoreBelow={hasMoreAfter}
        debugExpectedVisibleMessageRef={debugExpectedVisibleMessageRef}
        onLoadOlder={loadOlder}
        onLoadNewer={loadNewer}
        onDetachedFromBottom={freezeTail}
        onReachedBottom={resumeTail}
        onPermissionSelect={handlePermissionSelect}
      />
      <Minimap scrollMetrics={scrollMetrics} onScrollTo={handleScrollTo} />
    </div>
  );
}
