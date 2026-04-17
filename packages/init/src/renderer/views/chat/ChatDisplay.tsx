import { useMemo, useCallback, useRef, useState } from "react";
import { useCollection, useDb } from "../../lib/kyju-react";
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

export type ChatDisplayProps = {
  agentId: string;
  scrollToBottomRef?: React.MutableRefObject<(() => void) | null>;
};

export function ChatDisplay({ agentId, scrollToBottomRef }: ChatDisplayProps) {
  const agents = useDb((root) => root.plugin.kernel.agents);
  const agent = agents?.find((a) => a.id === agentId);
  const streaming = agent?.status === "streaming";
  const { items: allEvents } = useCollection(agent?.eventLog);
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
        onLoadOlder={loadOlder}
        onLoadNewer={loadNewer}
        onDetachedFromBottom={freezeTail}
        onReachedBottom={resumeTail}
      />
      <Minimap scrollMetrics={scrollMetrics} onScrollTo={handleScrollTo} />
    </div>
  );
}
