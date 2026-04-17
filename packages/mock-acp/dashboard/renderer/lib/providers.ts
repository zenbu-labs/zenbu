import React, { useContext } from "react"
import type { ClientProxy } from "@zenbu/kyju"
import type { RouterProxy } from "@zenbu/zenrpc"
import type { DashboardSchema } from "../../shared/schema/index"
import type { ServerRouter } from "../../main/router"

const RpcContext = React.createContext<RouterProxy<ServerRouter> | null>(null)
export const RpcProvider = RpcContext.Provider

export function useRpc(): RouterProxy<ServerRouter> {
  const rpc = useContext(RpcContext)
  if (!rpc) throw new Error("useRpc must be used inside RpcProvider")
  return rpc
}

const KyjuClientContext = React.createContext<ClientProxy<DashboardSchema> | null>(null)
export const KyjuClientProvider = KyjuClientContext.Provider

export function useKyjuClient(): ClientProxy<DashboardSchema> {
  const client = useContext(KyjuClientContext)
  if (!client) throw new Error("useKyjuClient must be used inside KyjuClientProvider")
  return client
}
