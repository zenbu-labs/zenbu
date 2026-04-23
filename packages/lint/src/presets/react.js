import zenbuPlugin from "../plugin.js"

export default [
  {
    plugins: { zenbu: zenbuPlugin },
    files: ["**/*.tsx", "**/*.jsx"],
    rules: {
      "zenbu/one-react-component-per-file": "error",
    },
  },
]
