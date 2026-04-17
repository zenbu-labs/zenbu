import { spawn } from "node:child_process";
import type { Registry } from "../registry.ts";
import { hasFlag, stripFlags } from "../cli.ts";
import { magicHelp } from "../magic-help.ts";

export async function runCommand(
  name: string,
  args: readonly string[],
  registry: Registry
): Promise<number> {
  const entry = await registry.get(name);

  if (entry.status === "archived") {
    throw new Error(
      `Script "${name}" is archived. Use a different script or re-register it.`
    );
  }

  if (hasFlag(args, "--magic-help")) {
    await magicHelp(entry.path, registry, { scriptName: name });
    return 0;
  }

  const passthrough = stripFlags([...args], ["--magic-help"]);

  return new Promise<number>((resolve) => {
    const child = spawn("bun", ["run", entry.path, ...passthrough], {
      stdio: "inherit",
      env: process.env,
    });

    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", (err) => {
      console.error(`Failed to run script: ${err.message}`);
      resolve(1);
    });
  });
}
