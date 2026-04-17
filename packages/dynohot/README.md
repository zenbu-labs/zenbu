# @zenbu/dynohot

Fork of [dynohot](https://github.com/laverdet/dynohot) (v2.1.1) — Hot module reloading for Node.js.

## Changes from upstream

- **Non-file protocol support**: The resolve hook no longer mangles URLs with non-`file:` protocols (e.g. `electron:`). These modules are passed through as non-reloadable imports instead of causing `ERR_UNSUPPORTED_ESM_URL_SCHEME` errors.
- **Non-dynohot import tolerance**: The `iterate` and `link` methods gracefully handle child modules that weren't transformed by dynohot (when `entry.controller` is not a function), instead of throwing `TypeError: child.controller is not a function`.

These changes enable dynohot to work inside Electron, where `import { BrowserWindow } from "electron"` resolves to the `electron:` protocol.



---

note to future self:

this library is useful because it allows you to swap the imports existing modules reference via imports using a compiler that updates all references to go through a proxy layer for every import direct reference

it then re-implements esm import spec and hacks TDZ to make ciruclar references work

its also useful because if you were to just re-evaluate all services and give them isolated dependency trees, you could definitely just re-evaluate new dynamically exec'd js, but all the parent references no longer know how to observe you, so you would need a bespoke runtime lookup while this feels more like writing typescript

the fork can definitely turn into upstream patches eventually. A nice benefit of forking is u get the source code locally and thats source of truth always when debugging