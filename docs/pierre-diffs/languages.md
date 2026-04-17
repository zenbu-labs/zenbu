# Supported Languages

## Type Definition

```ts
type SupportedLanguages = BundledLanguage | 'text' | 'ansi' | (string & {});
```

## Shiki BundledLanguage (all supported)

Every language bundled with Shiki v3 is supported. This includes 200+ languages. Notable ones:

### Web
`html`, `css`, `scss`, `less`, `javascript`, `typescript`, `jsx`, `tsx`, `json`, `jsonc`, `yaml`, `toml`, `xml`, `svg`, `graphql`, `vue`, `svelte`, `astro`, `mdx`, `markdown`

### Systems
`c`, `cpp`, `rust`, `go`, `zig`, `assembly`, `wasm`

### Backend
`python`, `ruby`, `java`, `kotlin`, `scala`, `swift`, `objective-c`, `php`, `perl`, `lua`, `r`, `julia`, `elixir`, `erlang`, `haskell`, `ocaml`, `clojure`, `fsharp`, `csharp`

### DevOps / Config
`bash`, `zsh`, `fish`, `powershell`, `dockerfile`, `docker-compose`, `terraform`, `nginx`, `apache`, `toml`, `ini`, `properties`

### Data / Query
`sql`, `graphql`, `prisma`, `proto`, `csv`

### Special
- `text` — no highlighting, plain text (always available, no grammar to load)
- `ansi` — ANSI terminal escape code highlighting

## Language Detection

Language is inferred from filename extension via `getFiletypeFromFileName()`. Override with the `lang` field on `FileContents` or `FileDiffMetadata`.

### Custom Language Registration

```ts
import { registerCustomLanguage } from '@pierre/diffs';

registerCustomLanguage('my-lang', myLanguageGrammar);
```

Custom languages must provide a `LanguageRegistration` (TextMate grammar).

### Custom Extension Mapping

Map new file extensions to existing languages:

```ts
// Internal API for custom extension → language mapping
// Used via worker sync: customExtensionMap
```

## Fallback Behavior

If a language cannot be resolved (unknown extension, no custom registration), the file is rendered as `'text'` — no syntax highlighting, but all diff features (line numbers, intra-line diffs, backgrounds) still work.

## Worker Language Loading

Languages are lazily loaded. When using workers:
1. Languages specified in `langs` during `WorkerPoolManager` construction are pre-resolved
2. Additional languages are resolved on-demand when a file with an unloaded language is rendered
3. The manager tracks which languages each worker has and sends resolved grammars with render requests
