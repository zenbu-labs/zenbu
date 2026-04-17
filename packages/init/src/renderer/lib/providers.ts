import React, { useContext } from "react";
import type { ClientProxy, SchemaShape } from "@zenbu/kyju";
import type { RouterProxy, EventProxy } from "@zenbu/zenrpc";
import type { ServiceRouter } from "#registry/services";
import type { SectionedClient } from "./kyju-react";
import type { ZenbuEvents } from "../../../shared/events";

export type RpcType = RouterProxy<ServiceRouter> & {
  [service: string]: { [method: string]: (...args: any[]) => Promise<any> }
}

const RpcContext = React.createContext<RpcType | null>(null);
export const RpcProvider = RpcContext.Provider;

export function useRpc(): RpcType {
  const rpc = useContext(RpcContext);
  if (!rpc) throw new Error("useRpc must be used inside RpcProvider");
  return rpc;
}

const EventsContext = React.createContext<EventProxy<ZenbuEvents> | null>(null);
export const EventsProvider = EventsContext.Provider;

export function useEvents(): EventProxy<ZenbuEvents> {
  const events = useContext(EventsContext);
  if (!events) throw new Error("useEvents must be used inside EventsProvider");
  return events;
}

const KyjuClientContext = React.createContext<ClientProxy<SchemaShape> | null>(
  null,
);
export const KyjuClientProvider = KyjuClientContext.Provider;

export function useKyjuClient(): SectionedClient {
  const client = useContext(KyjuClientContext);
  if (!client)
    throw new Error("useKyjuClient must be used inside KyjuClientProvider");
  return client as unknown as SectionedClient;
}
