import { parseBinding } from "../../../lib/shortcut-keys";

export interface ResolvedBinding {
  id: string;
  scope: string;
  /** Canonicalized combos that make up this chord. */
  chord: string[];
  /** Optional activation clause (DB dot-path, optionally `!`-negated). */
  when?: string;
}

export type MatchResult =
  | { kind: "none" }
  | { kind: "prefix" }
  | { kind: "match"; binding: ResolvedBinding };

export function buildResolvedBindings(
  registry: {
    id: string
    defaultBinding: string
    scope: string
    when?: string
  }[],
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
    result.push({
      id: entry.id,
      scope: entry.scope,
      chord,
      when: entry.when,
    });
  }
  return result;
}

/**
 * Evaluate a `when` clause against a DB root. Supports dot-paths and a
 * single optional `!` negation prefix. Missing paths and undefined values
 * are falsy. No `when` means "always active" → returns true.
 */
export function evalWhen(when: string | undefined, root: unknown): boolean {
  if (!when) return true;
  const trimmed = when.trim();
  const negated = trimmed.startsWith("!");
  const path = (negated ? trimmed.slice(1) : trimmed).trim();
  if (!path) return true;
  const parts = path.split(".");
  let cur: any = root;
  for (const p of parts) {
    if (cur == null) {
      cur = undefined;
      break;
    }
    cur = cur[p];
  }
  const truthy = Boolean(cur);
  return negated ? !truthy : truthy;
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
  processCombo(
    combo: string,
    resolved: ResolvedBinding[],
    dbRoot?: unknown,
  ): MatchResult {
    this.armed.push(combo);
    const current = this.armed.join(" ");

    // Collect every chord match and pick by specificity: a binding with a
    // truthy `when` clause beats one without (VSCode semantics). Bindings
    // with `when` clauses that evaluate falsy are excluded entirely.
    const allMatches: ResolvedBinding[] = [];
    for (const r of resolved) {
      if (r.chord.join(" ") !== current) continue;
      if (r.when !== undefined && !evalWhen(r.when, dbRoot)) continue;
      allMatches.push(r);
    }
    if (allMatches.length > 0) {
      const withWhen = allMatches.find((m) => m.when !== undefined);
      const chosen = withWhen ?? allMatches[0];
      this.reset();
      return { kind: "match", binding: chosen };
    }

    const hasPrefix = resolved.some((r) => {
      if (r.chord.length <= this.armed.length) return false;
      if (r.when !== undefined && !evalWhen(r.when, dbRoot)) return false;
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
