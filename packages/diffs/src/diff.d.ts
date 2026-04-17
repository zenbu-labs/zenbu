declare module 'diff' {
  interface Change {
    value: string
    added?: boolean
    removed?: boolean
    count?: number
  }

  export function diffChars(oldStr: string, newStr: string): Change[]
  export function diffWordsWithSpace(oldStr: string, newStr: string): Change[]
}
