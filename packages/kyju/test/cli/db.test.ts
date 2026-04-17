import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import path from "node:path";
import { seedDb } from "../../scripts/seed-db";

let dbPath: string;
let cleanup: () => void;

const kyjuRoot = path.resolve(__dirname, "../..");

beforeAll(async () => {
  execSync("tsx build.ts", { cwd: kyjuRoot, stdio: "pipe" });
  const result = await seedDb();
  dbPath = result.dbPath;
  cleanup = result.cleanup;
});

afterAll(() => cleanup?.());

const run = (subcmd: string) =>
  execSync(`node dist/bin.cjs db --db "${dbPath}" ${subcmd}`, {
    cwd: kyjuRoot,
    encoding: "utf-8",
  });

describe("kyju db root", () => {
  it("prints root as JSON with expected fields", () => {
    const output = run("root");
    const root = JSON.parse(output);
    expect(root.title).toBe("Test Project");
    expect(root.count).toBe(42);
    expect(root.messages).toHaveProperty("collectionId");
    expect(root.logs).toHaveProperty("collectionId");
    expect(root.readme).toHaveProperty("blobId");
  });
});

describe("kyju db collections", () => {
  it("lists both collections with metadata", () => {
    const output = run("collections");
    expect(output).toContain("messages");
    expect(output).toContain("logs");
    expect(output).toContain("count:");
  });
});

describe("kyju db collection", () => {
  it("reads all items from a collection by field name", () => {
    const output = run("collection messages --json");
    const items = JSON.parse(output);
    expect(items).toHaveLength(25);
    expect(items[0]).toHaveProperty("text", "Message 1");
  });

  it("reads a single page", () => {
    const output = run("collection messages --page 0 --json");
    const items = JSON.parse(output);
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(25);
  });

  it("reads by raw collectionId", () => {
    const root = JSON.parse(run("root"));
    const colId = root.messages.collectionId;
    const output = run(`collection ${colId} --json`);
    const items = JSON.parse(output);
    expect(items).toHaveLength(25);
  });
});

describe("kyju db blobs", () => {
  it("lists blobs with size info", () => {
    const output = run("blobs");
    expect(output).toContain("readme");
    expect(output).toContain("bytes");
  });
});

describe("kyju db blob", () => {
  it("prints blob content as text", () => {
    const output = run("blob readme");
    expect(output).toContain("# README");
    expect(output).toContain("This is a test database.");
  });
});

describe("kyju db paths", () => {
  it("prints resolved file paths", () => {
    const output = run("paths");
    expect(output).toContain("root.json");
    expect(output).toContain("collections");
    expect(output).toContain("blobs");
    expect(output).toContain("data.jsonl");
  });
});

describe("kyju db op", () => {
  it("applies a root.set operation", () => {
    const op = JSON.stringify({
      type: "root.set",
      path: ["title"],
      value: "Updated",
    });
    run(`op '${op}'`);
    const root = JSON.parse(run("root"));
    expect(root.title).toBe("Updated");
  });

  it("applies a collection.concat operation", () => {
    const before = JSON.parse(run("collection messages --json"));
    const root = JSON.parse(run("root"));
    const op = JSON.stringify({
      type: "collection.concat",
      collectionId: root.messages.collectionId,
      data: [{ text: "New message", author: "cli", ts: 0 }],
    });
    run(`op '${op}'`);
    const after = JSON.parse(run("collection messages --json"));
    expect(after.length).toBe(before.length + 1);
  });
});
