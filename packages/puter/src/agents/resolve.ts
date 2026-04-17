import { createInterface } from "node:readline";
import type { AgentProvider, AgentName } from "./types.ts";
import { CodexProvider } from "./codex.ts";
import { OpenCodeProvider } from "./opencode.ts";
import { Registry } from "../registry.ts";

const ALL_PROVIDERS: AgentProvider[] = [
  new CodexProvider(),
  new OpenCodeProvider(),
];

function getProvider(name: AgentName): AgentProvider {
  const p = ALL_PROVIDERS.find((p) => p.name === name);
  if (!p) throw new Error(`Unknown agent: ${name}`);
  return p;
}

export async function resolveAgent(
  registry: Registry
): Promise<AgentProvider> {
  const config = await registry.getConfig();

  if (config.agent) {
    const provider = getProvider(config.agent);
    const available = await provider.isAvailable();
    if (!available) {
      throw new Error(
        `Configured agent "${config.agent}" is not installed. ` +
          `Install it or run \`puter agent\` to pick a different one.`
      );
    }
    return provider;
  }

  for (const provider of ALL_PROVIDERS) {
    if (await provider.isAvailable()) {
      return provider;
    }
  }

  throw new Error(
    "No AI agent found. Install one of:\n" +
      "  - codex:    https://github.com/openai/codex\n" +
      "  - opencode: https://open-code.ai\n\n" +
      "Then run `puter agent` to configure your preference."
  );
}

export async function interactiveAgentSelect(
  registry: Registry
): Promise<void> {
  const available: AgentProvider[] = [];
  for (const p of ALL_PROVIDERS) {
    const ok = await p.isAvailable();
    available.push(p);
    console.log(
      `  ${p.name.padEnd(10)} ${ok ? "✓ installed" : "✗ not found"}`
    );
  }

  const installed = available.filter(
    async (p) => await p.isAvailable()
  );
  if (installed.length === 0) {
    console.log("\nNo agents installed.");
    return;
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise<string>((resolve) => {
    rl.question(
      `\nSelect default agent (${ALL_PROVIDERS.map((p) => p.name).join("/")}): `,
      resolve
    );
  });
  rl.close();

  const choice = answer.trim().toLowerCase() as AgentName;
  if (choice !== "codex" && choice !== "opencode") {
    console.log("Invalid choice.");
    return;
  }

  await registry.setConfig({ agent: choice });
  console.log(`Default agent set to "${choice}".`);
}
