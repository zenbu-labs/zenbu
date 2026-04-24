import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  loadModule,
  loadSchema,
} from "../../src/cli/config";

function tmpPluginDir(name: string) {
  const dir = path.join(
    os.tmpdir(),
    `kyju-config-loader-${name}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

let cleanups: string[] = [];

afterEach(() => {
  for (const dir of cleanups) fs.rmSync(dir, { recursive: true, force: true });
  cleanups = [];
});

describe("CLI config loader", () => {
  it("resolves plugin-local bare imports from the consumer package root", () => {
    const dir = tmpPluginDir("consumer-root");
    cleanups.push(dir);

    fs.writeFileSync(path.join(dir, "package.json"), '{"name":"external-plugin"}\n');
    fs.mkdirSync(path.join(dir, "node_modules", "local-dep"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(dir, "node_modules", "local-dep", "index.js"),
      "exports.defaultCount = 7;\n",
    );
    fs.writeFileSync(
      path.join(dir, "schema.ts"),
      [
        'import { createSchema, f } from "#zenbu/kyju/schema";',
        'import { defaultCount } from "local-dep";',
        "export const schema = createSchema({ count: f.number().default(defaultCount) });",
        "",
      ].join("\n"),
    );

    const schema = loadSchema(path.join(dir, "schema.ts"));
    expect((schema.shape as any).count._defaultValue).toBe(7);
  });

  it("resolves @zenbu directory imports to index.ts", () => {
    const root = tmpPluginDir("testbu-dir");
    cleanups.push(root);

    const packagesDir = path.join(root, "packages");
    const pluginDir = path.join(packagesDir, "my-plugin");
    const sharedDir = path.join(packagesDir, "shared-lib");
    fs.mkdirSync(path.join(pluginDir, "src"), { recursive: true });
    fs.mkdirSync(sharedDir, { recursive: true });
    fs.mkdirSync(path.join(packagesDir, "kernel"), { recursive: true });
    fs.mkdirSync(path.join(packagesDir, "kyju"), { recursive: true });

    fs.writeFileSync(path.join(root, "package.json"), '{"name":"monorepo"}\n');
    fs.writeFileSync(path.join(pluginDir, "package.json"), '{"name":"my-plugin"}\n');

    fs.writeFileSync(
      path.join(sharedDir, "index.ts"),
      "export const SHARED_VALUE = 42;\n",
    );

    fs.writeFileSync(
      path.join(pluginDir, "src", "schema.ts"),
      [
        'import { createSchema, f } from "#zenbu/kyju/schema";',
        'import { SHARED_VALUE } from "#zenbu/shared-lib";',
        "export const schema = createSchema({ value: f.number().default(SHARED_VALUE) });",
        "",
      ].join("\n"),
    );

    const schema = loadSchema(path.join(pluginDir, "src", "schema.ts"));
    expect((schema.shape as any).value._defaultValue).toBe(42);
  });

  it("loads migration barrels with loadModule", () => {
    const root = tmpPluginDir("barrel-loader");
    cleanups.push(root);

    const pluginDir = path.join(root, "packages", "my-plugin");
    const kyjuDir = path.join(pluginDir, "kyju");
    fs.mkdirSync(kyjuDir, { recursive: true });

    fs.writeFileSync(path.join(root, "package.json"), '{"name":"monorepo"}\n');
    fs.writeFileSync(path.join(pluginDir, "package.json"), '{"name":"my-plugin"}\n');

    fs.writeFileSync(
      path.join(kyjuDir, "0000_initial.ts"),
      [
        "const migration = {",
        "  version: 1,",
        '  operations: [{ op: "add", key: "x", kind: "data", hasDefault: true, default: 0 }],',
        "};",
        "export default migration;",
        "",
      ].join("\n"),
    );

    fs.writeFileSync(
      path.join(kyjuDir, "index.ts"),
      [
        'import m0 from "./0000_initial";',
        "export const migrations = [m0];",
        "",
      ].join("\n"),
    );

    const mod = loadModule(path.join(kyjuDir, "index.ts"));
    expect(Array.isArray(mod.migrations)).toBe(true);
    expect(mod.migrations).toHaveLength(1);
  });
});
