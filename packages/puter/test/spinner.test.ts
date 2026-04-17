import { describe, it, expect } from "vitest";
import { estimateTokens } from "../src/spinner.ts";

describe("estimateTokens", () => {
  it("returns 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("estimates ~1 token per 3.7 chars", () => {
    expect(estimateTokens("hello")).toBe(2); // 5 / 3.7 = 1.35 → 2
    expect(estimateTokens("a")).toBe(1);
  });

  it("handles longer text", () => {
    const text = "The quick brown fox jumps over the lazy dog";
    const tokens = estimateTokens(text);
    // 43 chars / 3.7 ≈ 11.6 → 12
    expect(tokens).toBe(12);
  });

  it("scales linearly", () => {
    const short = estimateTokens("hello world");
    const long = estimateTokens("hello world".repeat(10));
    expect(long).toBeGreaterThan(short * 5);
  });
});
