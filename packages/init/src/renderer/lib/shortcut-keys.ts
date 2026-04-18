export interface KeyStroke {
  key: string;
  code: string;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
}

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * Build a canonical combo string like "cmd+shift+p" from a KeyboardEvent.
 * Returns null for pure modifier keypresses (shift alone, etc.).
 */
export function comboFromEvent(event: KeyboardEvent): string | null {
  if (isPureModifier(event.key)) return null;
  return comboFromStroke({
    key: event.key,
    code: event.code,
    ctrl: event.ctrlKey,
    meta: event.metaKey,
    alt: event.altKey,
    shift: event.shiftKey,
  });
}

export function comboFromStroke(s: KeyStroke): string {
  const parts: string[] = [];
  if (s.meta) parts.push(isMac ? "cmd" : "meta");
  if (s.ctrl) parts.push("ctrl");
  if (s.alt) parts.push(isMac ? "option" : "alt");
  if (s.shift) parts.push("shift");
  parts.push(normalizeKey(s.key, s.code, s.shift));
  return parts.join("+");
}

function isPureModifier(key: string): boolean {
  return (
    key === "Shift" ||
    key === "Control" ||
    key === "Alt" ||
    key === "Meta" ||
    key === "CapsLock" ||
    key === "OS" ||
    key === "AltGraph"
  );
}

function normalizeKey(key: string, code: string, shift: boolean): string {
  if (key === " ") return "space";
  if (key === "Escape") return "esc";
  if (key === "ArrowUp") return "up";
  if (key === "ArrowDown") return "down";
  if (key === "ArrowLeft") return "left";
  if (key === "ArrowRight") return "right";
  if (key === "Enter") return "enter";
  if (key === "Tab") return "tab";
  if (key === "Backspace") return "backspace";
  if (key === "Delete") return "delete";
  if (key === "Home") return "home";
  if (key === "End") return "end";
  if (key === "PageUp") return "pageup";
  if (key === "PageDown") return "pagedown";

  // Letters: always lowercase, regardless of shift state (so "shift+a" is the
  // canonical form, not "shift+A").
  if (/^[a-zA-Z]$/.test(key)) return key.toLowerCase();

  // Digits: if shift is held, the browser reports the shifted glyph (e.g.
  // "!"). Fall back to the code ("Digit1") for digit stability.
  if (shift && /^Digit[0-9]$/.test(code)) {
    return code.slice(-1);
  }

  return key.toLowerCase();
}

/**
 * Parse a binding string like "cmd+shift+p" or "cmd+k cmd+s" into a list of
 * space-separated combo strings (each combo is stored canonicalized in
 * lowercase).
 */
export function parseBinding(binding: string): string[] {
  return binding
    .trim()
    .split(/\s+/)
    .map(canonicalizeCombo)
    .filter((c) => c.length > 0);
}

/**
 * Canonicalize a combo string so modifiers always appear in the same order.
 * Accepts human-readable inputs like "Shift+Cmd+P" and returns
 * "cmd+shift+p".
 */
export function canonicalizeCombo(combo: string): string {
  const parts = combo
    .toLowerCase()
    .split("+")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length === 0) return "";
  const mods: string[] = [];
  let key = "";
  for (const p of parts) {
    if (p === "cmd" || p === "meta" || p === "super") mods.push("cmd");
    else if (p === "ctrl" || p === "control") mods.push("ctrl");
    else if (p === "alt" || p === "option" || p === "opt") mods.push("alt");
    else if (p === "shift") mods.push("shift");
    else key = p;
  }
  const order = ["cmd", "ctrl", "alt", "shift"];
  mods.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const mapped = mods.map((m) => {
    if (m === "cmd") return isMac ? "cmd" : "meta";
    if (m === "alt") return isMac ? "option" : "alt";
    return m;
  });
  return [...mapped, key].filter(Boolean).join("+");
}

export function formatBindingForDisplay(binding: string): string {
  return parseBinding(binding)
    .map((combo) =>
      combo
        .split("+")
        .map((p) => {
          if (p === "cmd") return "⌘";
          if (p === "ctrl") return "⌃";
          if (p === "option") return "⌥";
          if (p === "alt") return "Alt";
          if (p === "shift") return "⇧";
          if (p === "meta") return "Meta";
          if (p.length === 1) return p.toUpperCase();
          return p.charAt(0).toUpperCase() + p.slice(1);
        })
        .join(""),
    )
    .join(" ");
}
