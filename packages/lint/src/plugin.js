import oneReactComponentPerFile from "./rules/one-react-component-per-file.js"

export default {
  meta: { name: "@zenbu/lint", version: "0.0.0" },
  rules: {
    "one-react-component-per-file": oneReactComponentPerFile,
  },
}
