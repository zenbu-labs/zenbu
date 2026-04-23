import { describe, it, expect, afterEach, afterAll } from "vitest";
import { Effect } from "effect";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { Agent } from "../src/agent.ts";
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

function makeObserver() {
  const events: SessionUpdate[] = [];
  return {
    events,
    onSessionUpdate: (u: SessionUpdate) => {
      events.push(u);
    },
  };
}

function currentSessionId(agent: Agent): string | null {
  const state = agent.getState();
  return state.kind === "ready" || state.kind === "prompting"
    ? state.sessionId
    : null;
}

function extractResponseText(events: SessionUpdate[], startIdx = 0): string {
  return events
    .slice(startIdx)
    .filter(
      (e: any) =>
        e.sessionUpdate === "agent_message_chunk" && e.content?.type === "text",
    )
    .map((e: any) => e.content.text)
    .join("");
}

const defaultHandlers = {
  requestPermission: async () => ({
    outcome: { outcome: "selected" as const, optionId: "allow" },
  }),
};

function createCodexAgent(
  onSessionUpdate: (u: SessionUpdate) => void,
  cwd: string,
  id?: string,
) {
  return Agent.create({
      id,
      clientConfig: {
        command: "npx",
        args: ["tsx", codexAcpBridge],
        cwd,
        handlers: defaultHandlers,
      },
      cwd,
      onSessionUpdate,
    });
}

function createCursorAgent(
  onSessionUpdate: (u: SessionUpdate) => void,
  cwd: string,
  id?: string,
) {
  return Agent.create({
      id,
      clientConfig: {
        command: "agent",
        args: ["acp"],
        cwd,
        handlers: defaultHandlers,
      },
      cwd,
      onSessionUpdate,
    });
}

function makeTempDir(suffix: string): string {
  const dir = mkdtempSync(join(tmpdir(), `zenbu-test-${suffix}-`));
  tempDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of tempDirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {}
  }
});

describe.skipIf(!codexAvailable)("Agent config update (Codex)", () => {
  let agent: Agent;

  afterEach(async () => {
    if (agent) {
      await agent.close().catch(() => {});
    }
  });

  it("changeCwd resumes session and agent sees new directory", async () => {
    const obs = makeObserver();
    const dirA = makeTempDir("cwd-a");
    const dirB = makeTempDir("cwd-b");

    agent = await createCodexAgent(obs.onSessionUpdate, dirA, "cwd-test");

    await agent.send([
        {
          type: "text",
          text: "Respond with ONLY the absolute path of your current working directory. No other text.",
        },
      ]);

    const responseA = extractResponseText(obs.events);
    expect(responseA).toContain(dirA);

    const sessionBefore = currentSessionId(agent);
    expect(sessionBefore).toBeTruthy();
    const eventCountBefore = obs.events.length;

    await agent.changeCwd(dirB);

    await agent.send([
        {
          type: "text",
          text: "Respond with ONLY the absolute path of your current working directory. No other text.",
        },
      ]);

    const state = agent.getState();
    expect(state.kind).toBe("ready");

    const responseB = extractResponseText(obs.events, eventCountBefore);
    expect(responseB).toContain(dirB);
    expect(responseB).not.toContain(dirA);

    const sessionAfter = currentSessionId(agent);
    expect(sessionAfter).toBe(sessionBefore);

    expect(obs.events.length).toBeGreaterThan(eventCountBefore);
  }, 120_000);

  it("changeCwd preserves session ID", async () => {
    const obs = makeObserver();
    const dirA = makeTempDir("preserve-a");
    const dirB = makeTempDir("preserve-b");

    agent = await createCodexAgent(
      obs.onSessionUpdate,
      dirA,
      "preserve-test",
    );

    await agent.send([{ type: "text", text: "hello" }]);

    const sessionBefore = currentSessionId(agent);
    expect(sessionBefore).toBeTruthy();

    await agent.changeCwd(dirB);

    await agent.send([{ type: "text", text: "hello again" }]);

    const sessionAfter = currentSessionId(agent);
    expect(sessionAfter).toBe(sessionBefore);
  }, 120_000);
});

describe.skipIf(!codexAvailable || !cursorAvailable)(
  "Agent config update (cross-agent switching)",
  () => {
    let agent: Agent;

    afterEach(async () => {
      if (agent) {
        await agent.close().catch(() => {});
      }
    });

    it("changeStartCommand switches from Codex to Cursor and both produce responses", async () => {
      const obs = makeObserver();
      const dir = makeTempDir("switch");

      agent = await createCodexAgent(obs.onSessionUpdate, dir, "switch-test");

      await agent.send([
          {
            type: "text",
            text: "Respond with ONLY the word 'alpha'. Nothing else.",
          },
        ]);

      const codexResponse = extractResponseText(obs.events).toLowerCase();
      expect(codexResponse).toContain("alpha");
      const eventCountAfterCodex = obs.events.length;

      const sessionBefore = currentSessionId(agent);
      expect(sessionBefore).toBeTruthy();

      await agent.changeStartCommand("agent", ["acp"]);

      await agent.send([
          {
            type: "text",
            text: "Respond with ONLY the word 'beta'. Nothing else.",
          },
        ]);

      const stateAfterSend = agent.getState();
      expect(stateAfterSend.kind).toBe("ready");

      const cursorResponse = extractResponseText(
        obs.events,
        eventCountAfterCodex,
      ).toLowerCase();
      expect(cursorResponse).toContain("beta");

      const sessionAfter = currentSessionId(agent);
      expect(sessionAfter).toBeTruthy();
      expect(sessionAfter).not.toBe(sessionBefore);

      expect(obs.events.length).toBeGreaterThan(eventCountAfterCodex);
    }, 120_000);

    it("changeStartCommand switches from Cursor to Codex and both produce responses", async () => {
      const obs = makeObserver();
      const dir = makeTempDir("switch-back");

      agent = await createCursorAgent(
        obs.onSessionUpdate,
        dir,
        "switch-back-test",
      );

      await agent.send([
          {
            type: "text",
            text: "Respond with ONLY the word 'gamma'. Nothing else.",
          },
        ]);

      const cursorResponse = extractResponseText(obs.events).toLowerCase();
      expect(cursorResponse).toContain("gamma");
      const eventCountAfterCursor = obs.events.length;

      const sessionBefore = currentSessionId(agent);

      await agent.changeStartCommand("npx", ["tsx", codexAcpBridge]);

      await agent.send([
          {
            type: "text",
            text: "Respond with ONLY the word 'delta'. Nothing else.",
          },
        ]);

      const state = agent.getState();
      expect(state.kind).toBe("ready");

      const codexResponse = extractResponseText(
        obs.events,
        eventCountAfterCursor,
      ).toLowerCase();
      expect(codexResponse).toContain("delta");

      const sessionAfter = currentSessionId(agent);
      expect(sessionAfter).not.toBe(sessionBefore);

      expect(obs.events.length).toBeGreaterThan(eventCountAfterCursor);
    }, 120_000);

    it("changeStartCommand clears session -- gets a new session ID", async () => {
      const obs = makeObserver();
      const dir = makeTempDir("clear-session");

      agent = await createCodexAgent(obs.onSessionUpdate, dir, "clear-test");

      await agent.send([{ type: "text", text: "hello" }]);

      const sessionBefore = currentSessionId(agent);
      expect(sessionBefore).toBeTruthy();

      await agent.changeStartCommand("agent", ["acp"]);

      await agent.send([{ type: "text", text: "hello" }]);

      const sessionAfter = currentSessionId(agent);
      expect(sessionAfter).toBeTruthy();
      expect(sessionAfter).not.toBe(sessionBefore);
    }, 120_000);

    // NOTE: the old `configOptions are reported after changeStartCommand`
    // test used the `onConfigOptions` callback on AgentConfig, which has been
    // removed. The equivalent behavior (ACP advertises configOptions, the
    // agent syncs them into `agentConfigs[configId].availableModels`) is now
    // covered by the `reconciles agentConfigs.availableModels from ACP on
    // session start` test in agent-kyju.test.ts.

    it("changeStartCommand with invalid command produces error state", async () => {
      const obs = makeObserver();
      const dir = makeTempDir("bad-cmd");

      agent = await createCodexAgent(obs.onSessionUpdate, dir, "bad-cmd-test");

      await agent.send([{ type: "text", text: "hello" }]);

      const stateBefore = agent.getState();
      expect(stateBefore.kind).toBe("ready");

      await agent.changeStartCommand(
          "nonexistent-binary-that-does-not-exist-xyz",
          [],
      );

      let threw = false;
      try {
        await agent.send([{ type: "text", text: "hello" }]);
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    }, 30_000);
  },
);

describe.skipIf(!codexAvailable || !cursorAvailable)(
  "Agent context handoff",
  () => {
    let agent: Agent;

    afterEach(async () => {
      if (agent) {
        await agent.close().catch(() => {});
      }
    });

    it("codeword from previous conversation survives handoff after changeStartCommand", async () => {
      const obs = makeObserver();
      const dir = makeTempDir("handoff-codeword");

      agent = await createCodexAgent(
        obs.onSessionUpdate,
        dir,
        "handoff-codeword-test",
      );

      await agent.send([
          {
            type: "text",
            text: "Remember this codeword: pineapple. Just acknowledge it.",
          },
        ]);

      const codexResponse = extractResponseText(obs.events).toLowerCase();
      expect(codexResponse.length).toBeGreaterThan(0);

      const eventsBeforeSwitch = obs.events.length;

      await agent.changeStartCommand("agent", ["acp"]);

      await agent.send([
          {
            type: "text",
            text: "What was the codeword from the previous conversation? Respond with ONLY the codeword inside a <codeword> XML tag, like <codeword>word</codeword>. Nothing else.",
          },
        ]);

      const cursorResponse = extractResponseText(obs.events, eventsBeforeSwitch);
      const match = cursorResponse.match(/<codeword>(.*?)<\/codeword>/i);
      expect(match).toBeTruthy();
      expect(match![1].toLowerCase()).toContain("pineapple");
    }, 120_000);

    it("handoff context is only prepended once -- second message has no handoff tag", async () => {
      const obs = makeObserver();
      const dir = makeTempDir("handoff-once");

      agent = await createCodexAgent(
        obs.onSessionUpdate,
        dir,
        "handoff-once-test",
      );

      await agent.send([
          {
            type: "text",
            text: "Remember: the secret is 'mango'. Acknowledge.",
          },
        ]);

      const eventsBeforeSwitch = obs.events.length;

      await agent.changeStartCommand("agent", ["acp"]);

      await agent.send([
          {
            type: "text",
            text: "What was the secret from the previous conversation? Reply with ONLY the secret word in a <secret> tag.",
          },
        ]);

      const firstResponse = extractResponseText(obs.events, eventsBeforeSwitch);
      const firstMatch = firstResponse.match(/<secret>(.*?)<\/secret>/i);
      expect(firstMatch).toBeTruthy();
      expect(firstMatch![1].toLowerCase()).toContain("mango");

      const eventsAfterFirst = obs.events.length;

      await agent.send([
          {
            type: "text",
            text: "Reply with ONLY the word 'confirmed'. Nothing else.",
          },
        ]);

      const secondResponse = extractResponseText(
        obs.events,
        eventsAfterFirst,
      ).toLowerCase();
      expect(secondResponse).toContain("confirmed");
      expect(secondResponse).not.toContain("<handoff>");
    }, 180_000);
  },
);

describe.skipIf(!codexAvailable)("Agent handoff on loadSession unsupported", () => {
  let agent: Agent;

  afterEach(async () => {
    if (agent) {
      await agent.close().catch(() => {});
    }
  });

  it("agent that does not support loadSession gets handoff automatically on restart", async () => {
    const obs = makeObserver();
    const dir = makeTempDir("no-load");

    agent = await Agent.create({
        id: "no-load-test",
        clientConfig: {
          command: "npx",
          args: ["tsx", codexAcpBridge, "--no-load-session"],
          cwd: dir,
          handlers: defaultHandlers,
        },
        cwd: dir,
        onSessionUpdate: obs.onSessionUpdate,
      });

    await agent.send([
        {
          type: "text",
          text: "Remember this exact word: starfruit. Just say 'acknowledged'.",
        },
      ]);

    const responseAfterFirst = extractResponseText(obs.events);
    expect(responseAfterFirst.length).toBeGreaterThan(0);

    const sessionBefore = currentSessionId(agent);
    expect(sessionBefore).toBeTruthy();

    const eventsBeforeRestart = obs.events.length;

    await agent.changeCwd(makeTempDir("no-load-b"));

    await agent.send([
        {
          type: "text",
          text: "In the conversation transcript you were given, what word was the user asked you to remember? Say ONLY that single word, nothing else.",
        },
      ]);

    const sessionAfter = currentSessionId(agent);
    expect(sessionAfter).not.toBe(sessionBefore);

    const responseAfterRestart = extractResponseText(
      obs.events,
      eventsBeforeRestart,
    ).toLowerCase();
    expect(responseAfterRestart).toContain("starfruit");
  }, 120_000);
});
