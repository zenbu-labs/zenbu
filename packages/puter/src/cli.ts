import { Registry } from "./registry.ts";
import { registerCommand } from "./commands/register.ts";
import { listCommand } from "./commands/list.ts";
import { runCommand } from "./commands/run.ts";
import { updateCommand } from "./commands/update.ts";
import { archiveCommand } from "./commands/archive.ts";
import { catCommand } from "./commands/cat.ts";
import { magicCommand } from "./commands/magic.ts";
import { interactiveAgentSelect } from "./agents/resolve.ts";

export function parseFlag(
  args: readonly string[],
  name: string
): string | undefined {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

export function hasFlag(args: readonly string[], name: string): boolean {
  return args.includes(name);
}

export function stripFlags(
  args: readonly string[],
  flagNames: string[]
): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < args.length) {
    if (flagNames.includes(args[i])) {
      // value-bearing flags consume next arg too
      if (args[i] === "--name" || args[i] === "--agent" || args[i] === "--description") {
        i += 2;
      } else {
        i += 1;
      }
    } else {
      result.push(args[i]);
      i++;
    }
  }
  return result;
}

const BUILTIN_COMMANDS = new Set([
  "register",
  "list",
  "update",
  "archive",
  "cat",
  "magic",
  "agent",
  "help",
]);

function printUsage(): void {
  console.log(`puter - manage your personal CLI scripts

Commands:
  register <path> --name <name>   Register a script
  list                            List active scripts
  update --name <name> <path>     Update script path
  archive <name>                  Archive a script
  cat <name>                      Show script source tree
  magic "<prompt>"                Ask AI anything about your scripts
  agent                           Select default AI agent
  <name> [args...]                Run a registered script
  <name> --magic-help             Explain what a script does (AI)

Run \x1b[1mputer <command> --help\x1b[0m for detailed info on a command.`);
}

export interface CliDeps {
  registry: Registry;
}

export async function runCli(
  args: readonly string[],
  deps?: Partial<CliDeps>
): Promise<number> {
  const registry = deps?.registry ?? new Registry();
  const [command, ...rest] = args;

  if (!command || command === "help" || command === "--help") {
    printUsage();
    return 0;
  }

  try {
    switch (command) {
      case "register":
        await registerCommand(rest, registry);
        return 0;

      case "list":
        await listCommand(registry, rest);
        return 0;

      case "update":
        await updateCommand(rest, registry);
        return 0;

      case "archive":
        await archiveCommand(rest, registry);
        return 0;

      case "cat":
        await catCommand(rest, registry);
        return 0;

      case "magic":
        await magicCommand(rest, registry);
        return 0;

      case "agent":
        await interactiveAgentSelect(registry);
        return 0;

      default: {
        if (command.startsWith("-")) {
          console.error(`Unknown flag: ${command}`);
          printUsage();
          return 1;
        }
        return await runCommand(command, rest, registry);
      }
    }
  } catch (err: any) {
    console.error(err.message ?? String(err));
    return 1;
  }
}
