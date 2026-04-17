import { describe, it, expect, afterEach, afterAll } from "vitest";
import { Effect } from "effect";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { Agent } from "../src/agent.ts";
import type { EventLog } from "../src/event-log.ts";
import type { AgentStore } from "../src/store.ts";
import type { SessionUpdate } from "@agentclientprotocol/sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const codexAcpBridge = join(
  __dirname,
  "..",
  "..",
  "codex-acp",
  "src",
  "index.ts",
);

let codexAvailable = false;
try {
  execSync("which codex", { stdio: "ignore" });
  codexAvailable = true;
} catch {
  codexAvailable = false;
}

let cursorAvailable = false;
try {
  execSync("which agent", { stdio: "ignore" });
  cursorAvailable = true;
} catch {
  cursorAvailable = false;
}

const tempDirs: string[] = [];

function createTestEventLog() {
  const events: SessionUpdate[] = [];
  const log: EventLog = {
    append: (newEvents) =>
      Effect.gen(function* () {
        events.push(...newEvents);
      }),
  };
  return { log, events };
}

function createTestStore(): AgentStore & { sessions: Map<string, string> } {
  const sessions = new Map<string, string>();
  return {
    sessions,
    getSessionId: (agentId) =>
      Effect.succeed(sessions.get(agentId) ?? null),
    setSessionId: (agentId, sessionId) =>
      Effect.sync(() => { sessions.set(agentId, sessionId); }),
    deleteSessionId: (agentId) =>
      Effect.sync(() => { sessions.delete(agentId); }),
  };
}

function extractResponseText(events: SessionUpdate[], startIdx = 0): string {
  return events
    .slice(startIdx)
    .filter((e: any) => e.sessionUpdate === "agent_message_chunk" && e.content?.type === "text")
    .map((e: any) => e.content.text)
    .join("");
}

const defaultHandlers = {
  requestPermission: async () => ({
    outcome: { outcome: "selected" as const, optionId: "allow" },
  }),
};

function createCodexAgent(
  eventLog: EventLog,
  store: AgentStore,
  cwd: string,
  id?: string,
) {
  return Effect.runPromise(
    Agent.create({
      id,
      clientConfig: {
        command: "npx",
        args: ["tsx", codexAcpBridge],
        cwd,
        handlers: defaultHandlers,
      },
      cwd,
      eventLog,
      store,
    }),
  );
}

function createCursorAgent(
  eventLog: EventLog,
  store: AgentStore,
  cwd: string,
  id?: string,
) {
  return Effect.runPromise(
    Agent.create({
      id,
      clientConfig: {
        command: "agent",
        args: ["acp"],
        cwd,
        handlers: defaultHandlers,
      },
      cwd,
      eventLog,
      store,
    }),
  );
}

function makeTempDir(suffix: string): string {
  const dir = mkdtempSync(join(tmpdir(), `zenbu-test-${suffix}-`));
  tempDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of tempDirs) {
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
  }
});

describe.skipIf(!codexAvailable)("Agent config update (Codex)", () => {
  let agent: Agent;

  afterEach(async () => {
    if (agent) {
      await Effect.runPromise(agent.close()).catch(() => {});
    }
  });

  it("changeCwd resumes session and agent sees new directory", async () => {
    const { log, events } = createTestEventLog();
    const store = createTestStore();
    const dirA = makeTempDir("cwd-a");
    const dirB = makeTempDir("cwd-b");

    agent = await createCodexAgent(log, store, dirA, "cwd-test");

    await Effect.runPromise(
      agent.send([{ type: "text", text: "Respond with ONLY the absolute path of your current working directory. No other text." }]),
    );

    const responseA = extractResponseText(events);
    expect(responseA).toContain(dirA);

    const sessionBefore = await Effect.runPromise(store.getSessionId("cwd-test"));
    expect(sessionBefore).toBeTruthy();
    const eventCountBefore = events.length;

    await Effect.runPromise(agent.changeCwd(dirB));

    await Effect.runPromise(
      agent.send([{ type: "text", text: "Respond with ONLY the absolute path of your current working directory. No other text." }]),
    );

    const state = await Effect.runPromise(agent.getState());
    expect(state.kind).toBe("ready");

    const responseB = extractResponseText(events, eventCountBefore);
    expect(responseB).toContain(dirB);
    expect(responseB).not.toContain(dirA);

    const sessionAfter = await Effect.runPromise(store.getSessionId("cwd-test"));
    expect(sessionAfter).toBe(sessionBefore);

    expect(events.length).toBeGreaterThan(eventCountBefore);
  }, 120_000);

  it("changeCwd preserves session ID", async () => {
    const { log } = createTestEventLog();
    const store = createTestStore();
    const dirA = makeTempDir("preserve-a");
    const dirB = makeTempDir("preserve-b");

    agent = await createCodexAgent(log, store, dirA, "preserve-test");

    await Effect.runPromise(
      agent.send([{ type: "text", text: "hello" }]),
    );

    const sessionBefore = await Effect.runPromise(store.getSessionId("preserve-test"));
    expect(sessionBefore).toBeTruthy();

    await Effect.runPromise(agent.changeCwd(dirB));

    await Effect.runPromise(
      agent.send([{ type: "text", text: "hello again" }]),
    );

    const sessionAfter = await Effect.runPromise(store.getSessionId("preserve-test"));
    expect(sessionAfter).toBe(sessionBefore);
  }, 120_000);
});

describe.skipIf(!codexAvailable || !cursorAvailable)("Agent config update (cross-agent switching)", () => {
  let agent: Agent;

  afterEach(async () => {
    if (agent) {
      await Effect.runPromise(agent.close()).catch(() => {});
    }
  });

  it("changeStartCommand switches from Codex to Cursor and both produce responses", async () => {
    const { log, events } = createTestEventLog();
    const store = createTestStore();
    const dir = makeTempDir("switch");

    agent = await createCodexAgent(log, store, dir, "switch-test");

    await Effect.runPromise(
      agent.send([{ type: "text", text: "Respond with ONLY the word 'alpha'. Nothing else." }]),
    );

    const codexResponse = extractResponseText(events).toLowerCase();
    expect(codexResponse).toContain("alpha");
    const eventCountAfterCodex = events.length;

    const sessionBefore = await Effect.runPromise(store.getSessionId("switch-test"));
    expect(sessionBefore).toBeTruthy();

    await Effect.runPromise(
      agent.changeStartCommand("agent", ["acp"]),
    );

    await Effect.runPromise(
      agent.send([{ type: "text", text: "Respond with ONLY the word 'beta'. Nothing else." }]),
    );

    const stateAfterSend = await Effect.runPromise(agent.getState());
    expect(stateAfterSend.kind).toBe("ready");

    const cursorResponse = extractResponseText(events, eventCountAfterCodex).toLowerCase();
    expect(cursorResponse).toContain("beta");

    const sessionAfter = await Effect.runPromise(store.getSessionId("switch-test"));
    expect(sessionAfter).toBeTruthy();
    expect(sessionAfter).not.toBe(sessionBefore);

    expect(events.length).toBeGreaterThan(eventCountAfterCodex);
  }, 120_000);

  it("changeStartCommand switches from Cursor to Codex and both produce responses", async () => {
    const { log, events } = createTestEventLog();
    const store = createTestStore();
    const dir = makeTempDir("switch-back");

    agent = await createCursorAgent(log, store, dir, "switch-back-test");

    await Effect.runPromise(
      agent.send([{ type: "text", text: "Respond with ONLY the word 'gamma'. Nothing else." }]),
    );

    const cursorResponse = extractResponseText(events).toLowerCase();
    expect(cursorResponse).toContain("gamma");
    const eventCountAfterCursor = events.length;

    const sessionBefore = await Effect.runPromise(store.getSessionId("switch-back-test"));

    await Effect.runPromise(
      agent.changeStartCommand("npx", ["tsx", codexAcpBridge]),
    );

    await Effect.runPromise(
      agent.send([{ type: "text", text: "Respond with ONLY the word 'delta'. Nothing else." }]),
    );

    const state = await Effect.runPromise(agent.getState());
    expect(state.kind).toBe("ready");

    const codexResponse = extractResponseText(events, eventCountAfterCursor).toLowerCase();
    expect(codexResponse).toContain("delta");

    const sessionAfter = await Effect.runPromise(store.getSessionId("switch-back-test"));
    expect(sessionAfter).not.toBe(sessionBefore);

    expect(events.length).toBeGreaterThan(eventCountAfterCursor);
  }, 120_000);

  it("changeStartCommand clears session -- gets a new session ID", async () => {
    const { log } = createTestEventLog();
    const store = createTestStore();
    const dir = makeTempDir("clear-session");

    agent = await createCodexAgent(log, store, dir, "clear-test");

    await Effect.runPromise(
      agent.send([{ type: "text", text: "hello" }]),
    );

    const sessionBefore = await Effect.runPromise(store.getSessionId("clear-test"));
    expect(sessionBefore).toBeTruthy();

    await Effect.runPromise(
      agent.changeStartCommand("agent", ["acp"]),
    );

    await Effect.runPromise(
      agent.send([{ type: "text", text: "hello" }]),
    );

    const sessionAfter = await Effect.runPromise(store.getSessionId("clear-test"));
    expect(sessionAfter).toBeTruthy();
    expect(sessionAfter).not.toBe(sessionBefore);
  }, 120_000);

  it("configOptions are reported after changeStartCommand", async () => {
    const configOptionsHistory: any[][] = [];
    const { log } = createTestEventLog();
    const store = createTestStore();
    const dir = makeTempDir("config-opts");

    agent = await Effect.runPromise(
      Agent.create({
        id: "config-opts-test",
        clientConfig: {
          command: "npx",
          args: ["tsx", codexAcpBridge],
          cwd: dir,
          handlers: defaultHandlers,
        },
        cwd: dir,
        eventLog: log,
        store,
        onConfigOptions: (options) => {
          configOptionsHistory.push(options);
        },
      }),
    );

    await Effect.runPromise(
      agent.send([{ type: "text", text: "hello" }]),
    );

    expect(configOptionsHistory.length).toBeGreaterThanOrEqual(1);
    const codexOptions = configOptionsHistory[configOptionsHistory.length - 1];
    expect(codexOptions.length).toBeGreaterThan(0);
    const hasModelCategory = codexOptions.some((o: any) => o.category === "model");
    expect(hasModelCategory).toBe(true);

    const countBefore = configOptionsHistory.length;

    await Effect.runPromise(
      agent.changeStartCommand("agent", ["acp"]),
    );

    await Effect.runPromise(
      agent.send([{ type: "text", text: "hello" }]),
    );

    expect(configOptionsHistory.length).toBeGreaterThan(countBefore);
    const cursorOptions = configOptionsHistory[configOptionsHistory.length - 1];
    expect(cursorOptions.length).toBeGreaterThan(0);
  }, 120_000);

  it("changeStartCommand with invalid command produces error state", async () => {
    const { log } = createTestEventLog();
    const store = createTestStore();
    const dir = makeTempDir("bad-cmd");

    agent = await createCodexAgent(log, store, dir, "bad-cmd-test");

    await Effect.runPromise(
      agent.send([{ type: "text", text: "hello" }]),
    );

    const stateBefore = await Effect.runPromise(agent.getState());
    expect(stateBefore.kind).toBe("ready");

    await Effect.runPromise(
      agent.changeStartCommand("nonexistent-binary-that-does-not-exist-xyz", []),
    );

    const result = await Effect.runPromiseExit(
      agent.send([{ type: "text", text: "hello" }]),
    );

    expect(result._tag).toBe("Failure");
  }, 30_000);
});

describe.skipIf(!codexAvailable || !cursorAvailable)("Agent context handoff", () => {
  let agent: Agent;

  afterEach(async () => {
    if (agent) {
      await Effect.runPromise(agent.close()).catch(() => {});
    }
  });

  it("codeword from previous conversation survives handoff after changeStartCommand", async () => {
    const { log, events } = createTestEventLog();
    const store = createTestStore();
    const dir = makeTempDir("handoff-codeword");

    agent = await createCodexAgent(log, store, dir, "handoff-codeword-test");

    await Effect.runPromise(
      agent.send([{ type: "text", text: "Remember this codeword: pineapple. Just acknowledge it." }]),
    );

    const codexResponse = extractResponseText(events).toLowerCase();
    expect(codexResponse.length).toBeGreaterThan(0);

    const eventsBeforeSwitch = events.length;

    await Effect.runPromise(
      agent.changeStartCommand("agent", ["acp"]),
    );

    await Effect.runPromise(
      agent.send([{
        type: "text",
        text: "What was the codeword from the previous conversation? Respond with ONLY the codeword inside a <codeword> XML tag, like <codeword>word</codeword>. Nothing else.",
      }]),
    );

    const cursorResponse = extractResponseText(events, eventsBeforeSwitch);
    const match = cursorResponse.match(/<codeword>(.*?)<\/codeword>/i);
    expect(match).toBeTruthy();
    expect(match![1].toLowerCase()).toContain("pineapple");
  }, 120_000);

  it("handoff context is only prepended once -- second message has no handoff tag", async () => {
    const { log, events } = createTestEventLog();
    const store = createTestStore();
    const dir = makeTempDir("handoff-once");

    agent = await createCodexAgent(log, store, dir, "handoff-once-test");

    await Effect.runPromise(
      agent.send([{ type: "text", text: "Remember: the secret is 'mango'. Acknowledge." }]),
    );

    const eventsBeforeSwitch = events.length;

    await Effect.runPromise(
      agent.changeStartCommand("agent", ["acp"]),
    );

    await Effect.runPromise(
      agent.send([{
        type: "text",
        text: "What was the secret from the previous conversation? Reply with ONLY the secret word in a <secret> tag.",
      }]),
    );

    const firstResponse = extractResponseText(events, eventsBeforeSwitch);
    const firstMatch = firstResponse.match(/<secret>(.*?)<\/secret>/i);
    expect(firstMatch).toBeTruthy();
    expect(firstMatch![1].toLowerCase()).toContain("mango");

    const eventsAfterFirst = events.length;

    await Effect.runPromise(
      agent.send([{
        type: "text",
        text: "Reply with ONLY the word 'confirmed'. Nothing else.",
      }]),
    );

    const secondResponse = extractResponseText(events, eventsAfterFirst).toLowerCase();
    expect(secondResponse).toContain("confirmed");
    expect(secondResponse).not.toContain("<handoff>");
  }, 180_000);
});

describe.skipIf(!codexAvailable)("Agent handoff on loadSession unsupported", () => {
  let agent: Agent;

  afterEach(async () => {
    if (agent) {
      await Effect.runPromise(agent.close()).catch(() => {});
    }
  });

  it("agent that does not support loadSession gets handoff automatically on restart", async () => {
    const { log, events } = createTestEventLog();
    const store = createTestStore();
    const dir = makeTempDir("no-load");

    agent = await Effect.runPromise(
      Agent.create({
        id: "no-load-test",
        clientConfig: {
          command: "npx",
          args: ["tsx", codexAcpBridge, "--no-load-session"],
          cwd: dir,
          handlers: defaultHandlers,
        },
        cwd: dir,
        eventLog: log,
        store,
      }),
    );

    await Effect.runPromise(
      agent.send([{ type: "text", text: "Remember this exact word: starfruit. Just say 'acknowledged'." }]),
    );

    const responseAfterFirst = extractResponseText(events);
    expect(responseAfterFirst.length).toBeGreaterThan(0);

    const sessionBefore = await Effect.runPromise(store.getSessionId("no-load-test"));
    expect(sessionBefore).toBeTruthy();

    const eventsBeforeRestart = events.length;

    await Effect.runPromise(agent.changeCwd(makeTempDir("no-load-b")));

    await Effect.runPromise(
      agent.send([{
        type: "text",
        text: "In the conversation transcript you were given, what word was the user asked you to remember? Say ONLY that single word, nothing else.",
      }]),
    );

    const sessionAfter = await Effect.runPromise(store.getSessionId("no-load-test"));
    expect(sessionAfter).not.toBe(sessionBefore);

    const responseAfterRestart = extractResponseText(events, eventsBeforeRestart).toLowerCase();
    expect(responseAfterRestart).toContain("starfruit");
  }, 120_000);
});
