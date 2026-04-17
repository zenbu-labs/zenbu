import { register } from "node:module"

register("./node-loader.js", import.meta.url)
