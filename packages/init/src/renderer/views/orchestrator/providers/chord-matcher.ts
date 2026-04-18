import { parseBinding } from "../../../lib/shortcut-keys";

export interface ResolvedBinding {
  id: string;
  scope: string;
  /** Canonicalized combos that make up this chord. */
  chord: string[];
}

export type MatchResult =
  | { kind: "none" }
  | { kind: "prefix" }
  | { kind: "match"; binding: ResolvedBinding };

export function buildResolvedBindings(
  registry: { id: string; defaultBinding: string; scope: string }[],
  overrides: Record<string, string>,
  disabled: string[],
): ResolvedBinding[] {
  const disabledSet = new Set(disabled);
  const result: ResolvedBinding[] = [];
  for (const entry of registry) {
    if (disabledSet.has(entry.id)) continue;
    const raw = overrides[entry.id] ?? entry.defaultBinding;
    const chord = parseBinding(raw);
    if (chord.length === 0) continue;
    result.push({ id: entry.id, scope: entry.scope, chord });
  }
  return result;
}

/** Set of all combos that begin any chord — for synchronous preventDefault in iframes. */
export function bindingKeyUniverse(resolved: ResolvedBinding[]): {
  exact: Set<string>;
  prefixes: Set<string>;
} {
  const exact = new Set<string>();
  const prefixes = new Set<string>();
  for (const r of resolved) {
    exact.add(r.chord.join(" "));
    // Every proper prefix of the chord is a "prefix combo" worth arming on.
    for (let i = 1; i < r.chord.length; i++) {
      prefixes.add(r.chord.slice(0, i).join(" "));
    }
    if (r.chord.length > 0) {
      // The first combo by itself is relevant for single-key preventDefault
      // even when the combo is not yet a chord prefix — the iframe needs to
      // swallow it before the browser default fires.
      // (Already captured by exact for length=1; covered by prefixes otherwise.)
    }
  }
  return { exact, prefixes };
}

export class ChordMatcher {
  private armed: string[] = [];
  private timeout: ReturnType<typeof setTimeout> | null = null;

  constructor(private timeoutMs: number = 1000) {}

  /**
   * Process a combo. Returns:
   *  - `{ kind: "match", binding }` if the accumulated chord exactly matches a binding
   *  - `{ kind: "prefix" }` if it's a valid partial prefix of at least one binding (chord is armed)
   *  - `{ kind: "none" }` otherwise (matcher resets, caller may let the stroke bubble)
   */
  processCombo(combo: string, resolved: ResolvedBinding[]): MatchResult {
    this.armed.push(combo);
    const current = this.armed.join(" ");

    for (const r of resolved) {
      if (r.chord.join(" ") === current) {
        this.reset();
        return { kind: "match", binding: r };
      }
    }

    const hasPrefix = resolved.some((r) => {
      if (r.chord.length <= this.armed.length) return false;
      for (let i = 0; i < this.armed.length; i++) {
        if (r.chord[i] !== this.armed[i]) return false;
      }
      return true;
    });

    if (hasPrefix) {
      this.scheduleReset();
      return { kind: "prefix" };
    }

    this.reset();
    return { kind: "none" };
  }

  /** Returns true if the next keystroke is expected to continue an armed chord. */
  get isArmed(): boolean {
    return this.armed.length > 0;
  }

  reset() {
    this.armed = [];
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }

  private scheduleReset() {
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = setTimeout(() => {
      this.armed = [];
      this.timeout = null;
    }, this.timeoutMs);
  }
}
