import esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/cli/index.ts"],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "cjs",
  outfile: "dist/bin.cjs",
  banner: { js: "#!/usr/bin/env node" },
  external: ["tsx", "zod", "effect", "@effect/cli", "@effect/platform", "@effect/platform-node", "@effect/printer", "@effect/printer-ansi", "@effect/typeclass", "nanoid"],
});

console.log("Built dist/bin.cjs");
