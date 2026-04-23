import tseslint from "typescript-eslint"
import zenbuPlugin from "./plugin.js"
import reactPreset from "./presets/react.js"
import nodePreset from "./presets/node.js"

const ignores = {
  ignores: [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/.next/**",
    "**/.turbo/**",
    "**/coverage/**",
    "**/test-results/**",
    "**/*.d.ts",
  ],
}

export const base = [
  ignores,
  ...tseslint.configs.recommended,
  {
    plugins: { zenbu: zenbuPlugin },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-expect-error": "allow-with-description",
          "ts-ignore": true,
          "ts-nocheck": true,
          "ts-check": false,
        },
      ],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
]

export const react = reactPreset
export const node = nodePreset
export { zenbuPlugin as plugin }

export default base
