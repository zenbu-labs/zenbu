import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import Module from "node:module";
import type { Schema } from "../v2/db/schema";

export type KyjuConfig = {
  schema: string;
  out?: string;
};

export function defineConfig(config: KyjuConfig): KyjuConfig {
  return config;
}

export type ResolvedConfig = {
  schemaPath: string;
  outPath: string;
};

const moduleFile =
  typeof __filename !== "undefined"
    ? __filename
    : path.join(process.cwd(), "__kyju_cli__.mjs");
const localRequire = Module.createRequire(moduleFile);
let currentConsumerRequire: NodeRequire | null = null;
let currentHostPackagesDir: string | null = null;

const CONFIG_NAMES = [
  "kyju.config.ts",
  "kyju.config.js",
  "kyju.config.mjs",
];

export function findConfigFile(cwd: string): string {
  for (const name of CONFIG_NAMES) {
    const p = path.join(cwd, name);
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    `No kyju config found. Expected one of: ${CONFIG_NAMES.join(", ")}`,
  );
}

export function loadConfig(configPath: string): ResolvedConfig {
  const dir = path.dirname(path.resolve(configPath));

  const mod = loadModule(path.resolve(configPath));
  const config: KyjuConfig = mod.default ?? mod;

  if (!config.schema) {
    throw new Error("kyju config must specify a 'schema' path");
  }

  return {
    schemaPath: path.resolve(dir, config.schema),
    outPath: path.resolve(dir, config.out ?? "./kyju"),
  };
}

export function loadSchema(schemaPath: string): Schema {
  const mod = loadModule(schemaPath);
  const schema = mod.schema ?? mod.default;

  if (!schema || !schema.shape) {
    throw new Error(
      `Schema file must export a 'schema' (via named export or default) created with createSchema(). Got: ${typeof schema}`,
    );
  }

  return schema;
}

export function loadModule(modulePath: string): any {
  ensureTsxRegistered();

  const absPath = path.resolve(modulePath);
  currentConsumerRequire = createConsumerRequire(absPath);
  currentHostPackagesDir = findHostPackagesDir(path.dirname(absPath));
  return currentConsumerRequire(absPath);
}

let tsxRegistered = false;

function ensureTsxRegistered() {
  if (tsxRegistered) return;
  try {
    localRequire("tsx/cjs/api").register();
  } catch {
    try {
      localRequire("tsx");
    } catch {
      // tsx not available -- assume the files are already JS-compatible
    }
  }
  registerHostResolveHook();
  tsxRegistered = true;
}

let hookRegistered = false;

function registerHostResolveHook() {
  if (hookRegistered) return;
  hookRegistered = true;

  const orig = (Module as any)._resolveFilename;

  (Module as any)._resolveFilename = function (
    request: string,
    parent: any,
    isMain: boolean,
    options: any,
  ) {
    if (request.startsWith("#zenbu/")) {
      const packagesDir =
        currentHostPackagesDir ?? findHostPackagesDir(process.cwd());
      const resolved = path.resolve(
        packagesDir,
        request.slice("#zenbu/".length),
      );
      if (path.extname(resolved)) {
        return orig.call(this, resolved, parent, isMain, options);
      }
      if (fs.existsSync(resolved + ".ts")) {
        return resolved + ".ts";
      }
      if (fs.existsSync(path.join(resolved, "index.ts"))) {
        return path.join(resolved, "index.ts");
      }
      return orig.call(this, resolved, parent, isMain, options);
    }
    return orig.call(this, request, parent, isMain, options);
  };
}

function createConsumerRequire(modulePath: string): NodeRequire {
  const packageRoot = findNearestPackageRoot(path.dirname(modulePath));
  if (packageRoot) {
    return Module.createRequire(path.join(packageRoot, "package.json"));
  }
  return Module.createRequire(modulePath);
}

function findNearestPackageRoot(startDir: string): string | null {
  let dir = path.resolve(startDir);
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    dir = path.dirname(dir);
  }
  return null;
}

function findHostPackagesDir(startDir: string): string {
  let dir = path.resolve(startDir);
  while (dir !== path.dirname(dir)) {
    const packagesDir = path.join(dir, "packages");
    if (
      fs.existsSync(path.join(packagesDir, "kernel")) &&
      fs.existsSync(path.join(packagesDir, "kyju"))
    ) {
      return packagesDir;
    }
    dir = path.dirname(dir);
  }
  return path.join(os.homedir(), ".zenbu", "plugins", "zenbu", "packages");
}
