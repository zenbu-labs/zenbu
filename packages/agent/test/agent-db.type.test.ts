import { describe, it, expectTypeOf } from "vitest";
import type { Effect } from "effect";
import type { EffectClientProxy, KyjuError } from "@zenbu/kyju";
import { agentSchema, type AgentDb, type AgentRoot } from "../src/schema.ts";
import type { AgentConfig } from "../src/agent.ts";

type AgentShape = typeof agentSchema.shape;
type FragmentClient = EffectClientProxy<AgentShape>;

/**
 * These tests never execute meaningful runtime code; they exist purely so
 * the TypeScript compiler checks the structural contract between the agent
 * package's expectations (`AgentDb`) and what a real kyju effect client
 * provides. `expectTypeOf` throws at runtime only if the types don't line
 * up statically, so it's safe to assert once per case.
 */
describe("AgentDb structural contract", () => {
  it("a kyju client over exactly agentSchema satisfies AgentDb", () => {
    expectTypeOf<FragmentClient>().toMatchTypeOf<AgentDb>();
  });

  it("readRoot() resolves to AgentRoot (the section-level shape)", () => {
    expectTypeOf<AgentDb["readRoot"]>().returns.toEqualTypeOf<AgentRoot>();
  });

  it("update() returns the kyju Effect<void, KyjuError>", () => {
    expectTypeOf<AgentDb["update"]>().returns.toEqualTypeOf<
      Effect.Effect<void, KyjuError>
    >();
  });

  it("a handle with extra fields is still a valid AgentDb (structural subset)", () => {
    type SupersetHandle = AgentDb & {
      // Host-specific extras the agent class doesn't care about.
      hostConfig: { selectedTheme: string };
      customCommands: string[];
    };
    expectTypeOf<SupersetHandle>().toMatchTypeOf<AgentDb>();
  });

  it("AgentRoot carries the fields the Agent class reads/writes", () => {
    expectTypeOf<AgentRoot>().toHaveProperty("agents");
    expectTypeOf<AgentRoot>().toHaveProperty("agentConfigs");
    expectTypeOf<AgentRoot>().toHaveProperty("archivedAgents");
    expectTypeOf<AgentRoot>().toHaveProperty("hotAgentsCap");
  });
});

describe("AgentConfig (create-time) ergonomics", () => {
  it("db is optional — ephemeral mode compiles without it", () => {
    expectTypeOf<AgentConfig["db"]>().toEqualTypeOf<AgentDb | undefined>();
  });

  it("onStateChange, onSessionUpdate, firstPromptPreamble are all optional", () => {
    type Req = Required<AgentConfig>;
    expectTypeOf<Req["onStateChange"]>().not.toBeUndefined();
    expectTypeOf<Req["onSessionUpdate"]>().not.toBeUndefined();
    expectTypeOf<Req["firstPromptPreamble"]>().not.toBeUndefined();
    // Actual config allows omission:
    expectTypeOf<AgentConfig["onStateChange"]>().toEqualTypeOf<
      Req["onStateChange"] | undefined
    >();
  });

  it("no longer accepts the removed callback properties", () => {
    // If these regress back, the test will fail to compile because
    // `never` can't be assigned.
    type Keys = keyof AgentConfig;
    expectTypeOf<Extract<Keys, "onConfigOptions">>().toEqualTypeOf<never>();
    expectTypeOf<Extract<Keys, "onConfigChange">>().toEqualTypeOf<never>();
    expectTypeOf<Extract<Keys, "store">>().toEqualTypeOf<never>();
    expectTypeOf<Extract<Keys, "eventLog">>().toEqualTypeOf<never>();
    expectTypeOf<Extract<Keys, "firstPromptLatch">>().toEqualTypeOf<never>();
  });
});
