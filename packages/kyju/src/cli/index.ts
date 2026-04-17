import { randomUUID } from "node:crypto";
import { findConfigFile, loadConfig, loadSchema } from "./config";
import { serializeSchema, emptySnapshot } from "./serializer";
import { diffSnapshots } from "./differ";
import { generate, readJournal, getLastSnapshot, getSnapshotAtIndex } from "./generator";
import { runDb } from "./db";

function printUsage() {
  console.log(`
Usage: kyju <command> [options]

Commands:
  generate    Generate a migration from schema changes
  db          Inspect and operate on a database

Options:
  --config <path>   Path to kyju config file (default: auto-detect)
  --name <tag>      Custom migration name
  --custom          Generate migration with editable migrate() function
  --amend           Replace the last migration instead of creating a new one
  --help            Show this help message
`);
}

function parseArgs(argv: string[]): {
  command: string | null;
  config?: string;
  name?: string;
  custom: boolean;
  amend: boolean;
  help: boolean;
} {
  const result = { command: null as string | null, config: undefined as string | undefined, name: undefined as string | undefined, custom: false, amend: false, help: false };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i]!;
    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--config") {
      result.config = argv[++i];
    } else if (arg === "--name") {
      result.name = argv[++i];
    } else if (arg === "--custom") {
      result.custom = true;
    } else if (arg === "--amend") {
      result.amend = true;
    } else if (!arg.startsWith("-") && !result.command) {
      result.command = arg;
    }
    i++;
  }

  return result;
}

function runGenerate(opts: { config?: string; name?: string; custom: boolean; amend: boolean }) {
  const configPath = opts.config ?? findConfigFile(process.cwd());
  const resolved = loadConfig(configPath);

  console.log(`Schema: ${resolved.schemaPath}`);
  console.log(`Output: ${resolved.outPath}`);

  const schema = loadSchema(resolved.schemaPath);
  const journal = readJournal(resolved.outPath);

  let prevSnapshot;
  if (opts.amend && journal.entries.length >= 2) {
    prevSnapshot = getSnapshotAtIndex(resolved.outPath, journal, journal.entries.length - 2) ?? emptySnapshot;
  } else if (opts.amend) {
    prevSnapshot = emptySnapshot;
  } else {
    prevSnapshot = getLastSnapshot(resolved.outPath, journal) ?? emptySnapshot;
  }

  const currentSnapshot = serializeSchema(
    schema,
    randomUUID(),
    prevSnapshot.id,
  );

  const ops = diffSnapshots(prevSnapshot!, currentSnapshot);

  if (ops.length === 0 && !opts.amend) {
    console.log("\nNo schema changes detected.");
  } else {
    console.log(`\nDetected ${ops.length} change(s):`);
    for (const op of ops) {
      if (op.op === "add") {
        console.log(`  + ${op.key} (${op.kind})`);
      } else if (op.op === "remove") {
        console.log(`  - ${op.key} (${op.kind})`);
      } else if (op.op === "alter") {
        console.log(`  ~ ${op.key} (altered)`);
      }
    }

    const hasAlter = ops.some((o) => o.op === "alter");
    if (hasAlter) {
      console.log(
        "\n⚠ Field type changes detected. Generating custom migration skeleton.",
      );
    }

    const result = generate({
      outPath: resolved.outPath,
      snapshot: currentSnapshot,
      ops,
      name: opts.name,
      custom: opts.custom,
      amend: opts.amend,
    });

    console.log(`\n${opts.amend ? "Amended" : "Generated"}:`);
    console.log(`  Migration: ${result.migrationPath}`);
    console.log(`  Snapshot:  ${result.snapshotPath}`);
    console.log(`  Barrel:    ${result.barrelPath}`);
  }
}

if (process.argv[2] === "db") {
  runDb();
} else {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.command) {
    printUsage();
    process.exit(args.help ? 0 : 1);
  }

  if (args.command === "generate") {
    runGenerate({ config: args.config, name: args.name, custom: args.custom, amend: args.amend });
  } else {
    console.error(`Unknown command: ${args.command}`);
    printUsage();
    process.exit(1);
  }
}
