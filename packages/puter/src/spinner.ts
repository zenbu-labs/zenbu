const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function estimateTokens(text: string): number {
  // Frontier models (GPT-4o, Claude, etc.) average ~3.5–4 chars per token
  // for English prose/code. We use 3.7 as a middle estimate.
  return Math.ceil(text.length / 3.7);
}

export interface Spinner {
  update(charCount: number): void;
  stop(finalMessage?: string): void;
}

export function createSpinner(label: string): Spinner {
  let frame = 0;
  let chars = 0;
  let stopped = false;

  function render() {
    if (stopped) return;
    const tokens = estimateTokens(chars.toString().length > 0 ? "x".repeat(chars) : "");
    const tokenCount = Math.ceil(chars / 3.7);
    const icon = FRAMES[frame % FRAMES.length];
    const tokenStr = tokenCount > 0 ? ` · ~${tokenCount} tokens` : "";
    process.stderr.write(`\r\x1b[K\x1b[2m${icon} ${label}${tokenStr}\x1b[0m`);
    frame++;
  }

  const interval = setInterval(render, 80);
  render();

  return {
    update(charCount: number) {
      chars = charCount;
    },
    stop(finalMessage?: string) {
      stopped = true;
      clearInterval(interval);
      process.stderr.write(`\r\x1b[K`);
      if (finalMessage) {
        const tokenCount = Math.ceil(chars / 3.7);
        process.stderr.write(
          `\x1b[2m✓ ${finalMessage} (~${tokenCount} tokens)\x1b[0m\n`
        );
      }
    },
  };
}
