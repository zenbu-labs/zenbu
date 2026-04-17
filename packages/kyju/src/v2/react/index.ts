import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ClientCollection, ClientState, ClientEvent, KyjuJSON } from "../shared";
import type { SchemaShape, InferRoot, CollectionRefBrand, InferCollectionItem } from "../db/schema";
import type { ClientProxy } from "../client/client";

export type CollectionResult<Item> = {
  items: Item[];
  collection: ClientCollection | null;
  concat: (items: Item[]) => void;
};

type Replica = {
  getState: () => ClientState;
  subscribe: (cb: (state: ClientState) => void) => () => void;
  postMessage: (event: ClientEvent) => Promise<void>;
  onCollectionConcat: (collectionId: string, cb: (data: { collection: ClientCollection; newItems: unknown[] }) => void) => void;
  offCollectionConcat: (collectionId: string, cb: (data: { collection: ClientCollection; newItems: unknown[] }) => void) => void;
};

type KyjuContextValue<TShape extends SchemaShape> = {
  client: ClientProxy<TShape>;
  replica: Replica;
};

export function createKyjuReact<TShape extends SchemaShape>() {
  const KyjuContext = createContext<KyjuContextValue<TShape> | null>(null);

  type ProviderProps = {
    client: ClientProxy<TShape>;
    replica: Replica;
    children: ReactNode;
  };

  function KyjuProvider({ client, replica, children }: ProviderProps) {
    const value = useMemo<KyjuContextValue<TShape>>(
      () => ({ client, replica }),
      [client, replica],
    );
    return createElement(KyjuContext.Provider, { value }, children);
  }

  function useKyjuContext() {
    const ctx = useContext(KyjuContext);
    if (!ctx)
      throw new Error("useDb/useCollection must be used inside KyjuProvider");
    return ctx;
  }

  type Root = InferRoot<TShape>;

  function useDb(): Root;
  function useDb<T>(selector: (root: Root) => T): T;
  function useDb<T>(selector?: (root: Root) => T): T | Root {
    const { replica } = useKyjuContext();
    const selectorRef = useRef(selector);
    selectorRef.current = selector;

    const readSnapshot = () => {
      const state = replica.getState();
      if (state.kind !== "connected") return undefined;
      const root = state.root as Root;
      return selectorRef.current ? selectorRef.current(root) : root;
    };

    const [, forceRender] = useState(0);
    const [value, setValue] = useState(readSnapshot);

    useEffect(() => {
      let prev = value;
      return replica.subscribe((state: ClientState) => {
        if (state.kind !== "connected") return;
        const root = state.root as Root;
        if (!selectorRef.current) {
          setValue(() => root);
          forceRender((n) => n + 1);
          return;
        }
        const next = selectorRef.current(root);
        if (!Object.is(prev, next)) {
          prev = next;
          setValue(() => next);
        }
      });
    }, [replica.subscribe]);

    return value as T | Root;
  }

  function useCollection<T extends { collectionId: string } & CollectionRefBrand<unknown>>(
    ref: T | null | undefined,
  ): CollectionResult<InferCollectionItem<T>> {
    type Item = InferCollectionItem<T>;
    const { replica } = useKyjuContext();
    const collectionId = ref?.collectionId || null;

    const [state, setState] = useState<{
      items: Item[];
      collection: ClientCollection | null;
    }>({ items: [], collection: null });

    useEffect(() => {
      if (!collectionId) return;

      const onData = (data: { collection: ClientCollection; newItems: unknown[] }) => {
        const items = data.collection.pages.flatMap(
          (p: ClientCollection["pages"][number]) =>
            p.data.kind === "hot" ? (p.data.items as Item[]) : [],
        );
        setState({ items, collection: data.collection });
      };

      replica.onCollectionConcat(collectionId, onData);

      replica.postMessage({ kind: "subscribe-collection", collectionId }).then(() => {
        const s = replica.getState();
        if (s.kind === "connected") {
          const col = s.collections.find((c) => c.id === collectionId);
          if (col) onData({ collection: col, newItems: [] });
        }
      });

      return () => {
        replica.offCollectionConcat(collectionId, onData);
        replica.postMessage({ kind: "unsubscribe-collection", collectionId }).catch(() => {});
      };
    }, [collectionId, replica]);

    const concat = useMemo(() => {
      if (!collectionId) return (_items: Item[]) => {};
      return (items: Item[]) => {
        replica.postMessage({
          kind: "write",
          op: { type: "collection.concat", collectionId, data: items as KyjuJSON[] },
        });
      };
    }, [collectionId, replica]);

    return useMemo(() => ({ ...state, concat }), [state, concat]);
  }

  return { KyjuProvider, useDb, useCollection };
}
