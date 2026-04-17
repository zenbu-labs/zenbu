import type { HighlighterGeneric, BundledLanguage, BundledTheme, ThemedToken } from 'shiki'

type Highlighter = HighlighterGeneric<BundledLanguage, BundledTheme>

let instance: Promise<Highlighter> | Highlighter | undefined
const loadedLangs = new Set<string>(['text'])

export interface SyntaxToken {
  text: string
  color?: string
}

const EXT_TO_LANG: Record<string, string> = {
  ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
  json: 'json', jsonc: 'jsonc', css: 'css', scss: 'scss', less: 'less',
  html: 'html', vue: 'vue', svelte: 'svelte', astro: 'astro',
  md: 'markdown', mdx: 'mdx', yaml: 'yaml', yml: 'yaml', toml: 'toml',
  py: 'python', rb: 'ruby', rs: 'rust', go: 'go', java: 'java',
  kt: 'kotlin', swift: 'swift', c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
  cs: 'csharp', php: 'php', lua: 'lua', sh: 'bash', bash: 'bash', zsh: 'zsh',
  sql: 'sql', graphql: 'graphql', proto: 'proto', xml: 'xml', svg: 'xml',
  dockerfile: 'dockerfile', tf: 'terraform', ini: 'ini',
  r: 'r', ex: 'elixir', erl: 'erlang', hs: 'haskell', ml: 'ocaml',
  zig: 'zig', wasm: 'wasm',
}

export function langFromPath(path: string): string {
  const basename = path.split('/').pop() ?? path
  if (basename === 'Dockerfile' || basename === 'Makefile') return basename.toLowerCase()
  const ext = basename.includes('.') ? basename.split('.').pop()!.toLowerCase() : ''
  return EXT_TO_LANG[ext] ?? 'text'
}

async function getHighlighter(): Promise<Highlighter> {
  if (instance != null) {
    return instance
  }
  const { createHighlighter } = await import('shiki')
  instance = createHighlighter({
    themes: ['github-light'],
    langs: ['text'],
  })
  instance = await instance
  return instance
}

async function ensureLang(hl: Highlighter, lang: string): Promise<string> {
  if (lang === 'text' || loadedLangs.has(lang)) return lang
  try {
    const { bundledLanguages } = await import('shiki')
    if (lang in bundledLanguages) {
      await hl.loadLanguage(lang as BundledLanguage)
      loadedLangs.add(lang)
      return lang
    }
  } catch {
    // fall through
  }
  return 'text'
}

export async function tokenizeLines(
  lines: string[],
  lang: string,
): Promise<SyntaxToken[][]> {
  const hl = await getHighlighter()
  const resolvedLang = await ensureLang(hl, lang)

  const code = lines.join('\n')
  const result = hl.codeToTokens(code, {
    lang: resolvedLang as BundledLanguage,
    theme: 'github-light',
  })

  return result.tokens.map((lineTokens: ThemedToken[]) =>
    lineTokens.map((t) => ({
      text: t.content,
      color: t.color ?? undefined,
    }))
  )
}
