import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  discoverSections,
  resolveManifestModulePath,
} from "../src/main/services/db";

const KYJU_SCHEMA_PATH =
  "/Users/robby/.zenbu/plugins/zenbu/packages/kyju/src/v2/db/schema.ts";

function tmpPluginDir(name: string) {
  const dir = path.join(
    os.tmpdir(),
    `zenbu-section-discovery-${name}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

let cleanups: string[] = [];

afterEach(() => {
  for (const dir of cleanups) fs.rmSync(dir, { recursive: true, force: true });
  cleanups = [];
  vi.restoreAllMocks();
});

describe("section discovery", () => {
  it("resolves extensionless schema and directory migrations", async () => {
    const dir = tmpPluginDir("resolve");
    cleanups.push(dir);

    fs.writeFileSync(path.join(dir, "package.json"), '{"name":"tmp-plugin"}\n');
    fs.mkdirSync(path.join(dir, "kyju"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, "schema.js"),
      [
        `import { createSchema, f } from "${KYJU_SCHEMA_PATH}";`,
        "export const schema = createSchema({ count: f.number().default(0) });",
        "",
      ].join("\n"),
    );
    fs.writeFileSync(
      path.join(dir, "kyju", "index.js"),
      [
        "const migrations = [];",
        "export { migrations };",
        "",
      ].join("\n"),
    );

    await expect(resolveManifestModulePath(dir, "./schema")).resolves.toBe(
      path.join(dir, "schema.js"),
    );
    await expect(resolveManifestModulePath(dir, "./kyju")).resolves.toBe(
      path.join(dir, "kyju", "index.js"),
    );
  });

  it("loads sections from a config file with manifest-relative imports", async () => {
    const dir = tmpPluginDir("discover");
    cleanups.push(dir);

    fs.writeFileSync(path.join(dir, "package.json"), '{"name":"tmp-plugin"}\n');
    fs.mkdirSync(path.join(dir, "kyju"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, "schema.js"),
      [
        `import { createSchema, f } from "${KYJU_SCHEMA_PATH}";`,
        "export const schema = createSchema({ count: f.number().default(0) });",
        "",
      ].join("\n"),
    );
    fs.writeFileSync(
      path.join(dir, "kyju", "index.js"),
      [
        "const migrations = [{ version: 1, operations: [] }];",
        "export { migrations };",
        "",
      ].join("\n"),
    );
    fs.writeFileSync(
      path.join(dir, "zenbu.plugin.json"),
      JSON.stringify(
        {
          name: "tmp-plugin",
          schema: "./schema",
          migrations: "./kyju",
        },
        null,
        2,
      ) + "\n",
    );

    const configPath = path.join(dir, "config.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify(
        { plugins: [path.join(dir, "zenbu.plugin.json")] },
        null,
        2,
      ) + "\n",
    );

    const sections = await discoverSections(configPath);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.name).toBe("tmp-plugin");
    expect(Object.keys(sections[0]!.schema.shape)).toEqual(["count"]);
    expect(sections[0]!.migrations).toHaveLength(1);
  });

  it("skips sections when migrations fail to load and logs loudly", async () => {
    const dir = tmpPluginDir("migrations-fail");
    cleanups.push(dir);

    fs.writeFileSync(path.join(dir, "package.json"), '{"name":"tmp-plugin"}\n');
    fs.writeFileSync(
      path.join(dir, "schema.js"),
      [
        `import { createSchema, f } from "${KYJU_SCHEMA_PATH}";`,
        "export const schema = createSchema({ count: f.number().default(0) });",
        "",
      ].join("\n"),
    );
    fs.writeFileSync(
      path.join(dir, "zenbu.plugin.json"),
      JSON.stringify(
        {
          name: "tmp-plugin",
          schema: "./schema.js",
          migrations: "./missing-kyju",
        },
        null,
        2,
      ) + "\n",
    );

    const configPath = path.join(dir, "config.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify(
        { plugins: [path.join(dir, "zenbu.plugin.json")] },
        null,
        2,
      ) + "\n",
    );

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const sections = await discoverSections(configPath);

    expect(sections).toHaveLength(0);
    expect(errorSpy).toHaveBeenCalled();
    expect(
      errorSpy.mock.calls.some((call) =>
        call.map((part) => String(part)).join(" ").includes("failed to load migrations"),
      ),
    ).toBe(true);
  });
});
