import zod from "zod"
import { createSchema, f, type InferSchema, type InferRoot } from "@zenbu/kyju/schema"

export const zenCliSchema = createSchema({
  /**
   * Absolute path to the Electron Zenbu binary. Used by the zen CLI when
   * spawning a new window if no instance is already running.
   *
   * Default is the standard macOS install location; setup.ts overwrites
   * once the app is detected in /Applications, and `zen config set appPath`
   * allows overrides.
   */
  appPath: f.string().default("/Applications/Zenbu.app/Contents/MacOS/Zenbu"),
})

export const schema = zenCliSchema
export type ZenCliSchema = InferSchema<typeof zenCliSchema>
export type SchemaRoot = InferRoot<ZenCliSchema>
