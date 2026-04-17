export interface DiffViewerOptions {
  maxInlineLines: number
  diffStyle: 'unified' | 'split'
  lineDiffType: 'word-alt' | 'word' | 'char' | 'none'
  maxLineDiffLength: number
  showFileHeader: boolean
  fontSize: number
  lineHeight: number
}

export const DEFAULT_OPTIONS: DiffViewerOptions = {
  maxInlineLines: 300,
  diffStyle: 'unified',
  lineDiffType: 'word-alt',
  maxLineDiffLength: 1000,
  showFileHeader: false,
  fontSize: 12,
  lineHeight: 18,
}
