import { createKyjuReact } from "@zenbu/kyju/react"
import type { DashboardSchema } from "../../shared/schema/index"

export const { KyjuProvider, useDb, useCollection } =
  createKyjuReact<DashboardSchema>()
