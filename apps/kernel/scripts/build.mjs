import * as esbuild from "esbuild";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import { glob } from "fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

await esbuild.build({
  entryPoints: [path.join(root, "src/shell/index.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outdir: path.join(root, "dist/main"),
  external: [
    "electron",
    "vite",
    "@vitejs/plugin-react",
    "@tailwindcss/vite",
    "@zenbu/advice/node",
    "dynohot",
    "dynohot/*",
    "tsx",
    "tsx/*",
    "ws",
    "nanoid",
  ],
  banner: {
    js: `import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);`,
  },
});

const loaderSrc = path.join(root, "src/shell");
const loaderDest = path.join(root, "dist/main/src/shell");
fs.mkdirSync(loaderDest, { recursive: true });
for (const file of fs.readdirSync(loaderSrc)) {
  if (file.endsWith("-hooks.js")) {
    fs.copyFileSync(path.join(loaderSrc, file), path.join(loaderDest, file));
  }
}

console.log("\nBuild complete -> dist/main/");
