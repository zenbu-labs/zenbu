---
title: Devtools
description: Enhance your Effect development experience with the Effect Language Service and official VS Code/Cursor extension for advanced diagnostics, refactors, and intelligent code completion.
sidebar:
  order: 3
---

import { Aside, Steps, Tabs, TabItem } from "@astrojs/starlight/components"

Effect provides powerful development tools to enhance your coding experience and help you write safer, more maintainable code. These tools integrate directly into your editor, providing real-time feedback, intelligent refactors, and helpful diagnostics.

## Effect LSP

The Effect LSP extends your editor with Effect-specific features. It analyzes your Effect code and provides intelligent assistance through diagnostics, quick info, completions, and automated refactors.

It works in editors that supports the standard TypeScript LSP, such as Code, Cursor, Zed, NVim, etc.

### Installation

To install the Effect Language Service in your project:

<Steps>

1. Install the package as a development dependency:

   For monorepos, we suggest to install the language service at the root level. For single-package projects, install it in the package directory.

   <Tabs syncKey="package-manager">

   <TabItem label="npm" icon="seti:npm">

   ```sh showLineNumbers=false
   npm install @effect/language-service --save-dev
   ```

   </TabItem>

   <TabItem label="pnpm" icon="pnpm">

   ```sh showLineNumbers=false
   pnpm add -D @effect/language-service
   ```

   </TabItem>

   <TabItem label="Yarn" icon="seti:yarn">

   ```sh showLineNumbers=false
   yarn add --dev @effect/language-service
   ```

   </TabItem>

   <TabItem label="Bun" icon="bun">

   ```sh showLineNumbers=false
   bun add --dev @effect/language-service
   ```

   </TabItem>

   </Tabs>

2. Add the plugin to your `tsconfig.json`:

   ```json title="tsconfig.json"
   {
     "compilerOptions": {
       "plugins": [
         {
           "name": "@effect/language-service"
         }
       ]
     }
   }
   ```

3. Ensure your editor uses the workspace TypeScript version:

   This step is critical for the language service to function properly. The plugin must run on the TypeScript version installed in your project, not the one bundled with your editor.

   <Aside type="tip">
   In VS Code or Cursor, you can select the workspace TypeScript version by opening a TypeScript file, clicking on the TypeScript version number in the status bar, and selecting "Use Workspace Version".
   </Aside>

4. You're ready to play!

   Writing the following code in a file.ts inside your project, should result in an error diagnostic appearing, saying that Effect's must be yielded or assigned to a variable:

   ```ts
   import { Effect } from "effect"

   Effect.log("Hello world!")
   // ^- should be run or assigned to a variable!
   ```

</Steps>


### Features

The Effect Language Service provides a comprehensive set of features to enhance your development workflow:

#### Intelligent Quick Info

Hover over Effect values to see extended type information and detailed insights:

- **Effect Types**: See comprehensive type information for Effect values
- **Generator Parameters**: When hovering over `yield*` in `Effect.gen`, view detailed information about the yielded value
- **Layer Composition**: Visualize layer dependencies with interactive graphs showing how layers compose together
- **Service Dependencies**: Understand service requirements and their relationships at a glance

#### Real-time Diagnostics

Catch common mistakes and potential issues as you write code:

- **Floating Effects**: Detect Effect values that aren't assigned or yielded, preventing silent bugs
- **Layer Issues**: Catch layer requirement leaks and scope violations before runtime
- **Unnecessary Code**: Identify redundant `Effect.gen` or `pipe()` calls
- **Error Handling**: Detect misuse of catch functions on Effects that cannot fail
- **Version Conflicts**: Detect when multiple Effect versions are present in your project

#### Smart Completions

Speed up your coding with context-aware suggestions:

- **Generator Boilerplate**: Quickly scaffold `Effect.gen` functions
- **Scaffolds**: For `Effect.Service`, `Data.TaggedError` and friends.
- **Self Parameters**: Auto-complete for `Self` parameters in service declarations

#### Powerful Refactors

Transform your code with intelligent automated refactors:

- **Async to Effect**: Convert async functions to Effect using `gen` or `fn` syntax
- **Error Generation**: Generate tagged errors from promise-based code
- **Service Accessors**: Automatically implement service accessor functions
- **Pipe Conversion**: Transform function calls to pipe syntax
- **Pipe Styles**: Toggle between different pipe style formats
- **Layer Magic**: Automatically compose layers with correct dependencies

### Configuration

The Effect LSP provides also lots of configuration options such as changing severity or disabling diagnostic messages.

To see the full list of options and features, please visit the [README from the LSP repository](https://github.com/Effect-TS/language-service).

### Build-Time Diagnostics

While LSPs only activate during editing sessions, you may want to catch diagnostics during your build process.

Usually that's done through linting rules, but since almost all of the Effect diagnostics relies on types, that would mean enabling type-aware linting, which means performing type checking again on the project files.

To solve this, the Effect Language Service allows you to patch your local TypeScript installation, so diagnostics are emitted while performing type checking.

To enable it run the following command to modify your local TypeScript installation:

```sh showLineNumbers=false
effect-language-service patch
```

To make this automatic for all developers, add it to your `package.json`:

```json title="package.json"
{
  "scripts": {
    "prepare": "effect-language-service patch"
  }
}
```

This ensures the language service runs during compilation with the standard `tsc` command.


## VS Code / Cursor Extension

<Aside type="caution">
The editor extension does not include the Effect LSP! Installation of that should be performed per-project, this allows fine grained control on when to load it, for which projects and with a version pinned with your repository lockfile.
</Aside>

The editor extension provides utilities in helping you debug your Effect applications.

At the moment only Code and Code forks like Cursor are supported.

### Installation

The extension can be installed by searching directly in your editor extension page or from the [Code Marketplace](https://marketplace.visualstudio.com/items?itemName=effectful-tech.effect-vscode) or the [Open VSX Marketplace](https://open-vsx.org/extension/effectful-tech/effect-vscode).

### Debugger Features

With the Effect Extension, you'll find couple of new sections inside the Debug section of your editor that, once you pause execution, will .

- **Context**: Allows you to inspect the context of the currently paused Effect Fiber.
- **Span Stack**: Shows you the stack of telemetry spans that lead you into the execution of the currently paused Effect.
- **Fibers**: List all the Effect Fibers running in your application, allows you to inspect informations such as interrupt-ability and allows to request interruption of them.
- **Breakpoints**: Allows to enable "pause on defect"; letting your debugger pause when a Effect Fiber fails with a defect.

### Built-in Tracer and Metrics

The built-in tracer and metrics view allows to quickly see Effect Spans and Metrics of your app without spinning up an entire telemetry service.

To enable it, you need to install the following dependency in your project:

<Tabs syncKey="package-manager">

<TabItem label="npm" icon="seti:npm">

```sh showLineNumbers=false
npm install @effect/experimental
```

</TabItem>

<TabItem label="pnpm" icon="pnpm">

```sh showLineNumbers=false
pnpm install @effect/experimental
```

</TabItem>

<TabItem label="Yarn" icon="seti:yarn">

```sh showLineNumbers=false
yarn add @effect/experimental
```

</TabItem>

<TabItem label="Bun" icon="bun">

```sh showLineNumbers=false
bun add @effect/experimental
```

</TabItem>

</Tabs>

You can then import and use the DevTools module in your Effect app:

```ts
import { DevTools } from "@effect/experimental"
import { NodeRuntime, NodeSocket } from "@effect/platform-node"
import { Effect, Layer } from "effect"

const program = Effect.log("Hello!").pipe(
  Effect.delay(2000),
  Effect.withSpan("Hi", { attributes: { foo: "bar" } }),
  Effect.forever,
)
const DevToolsLive = DevTools.layer()

program.pipe(Effect.provide(DevToolsLive), NodeRuntime.runMain)
```

If you are using `@effect/opentelemetry` in your project, then it is important that you provide the DevTools layer before your tracing layers, so the tracer is patched correctly.

Now start both your editor and your app. Inside the Effect panel, in the clients section you'll see a newly connected client.

In the bottom of your editor, near your terminal, a new tab "Effect Tracer" will appear as well, showing visually your spans as they happen in real time.