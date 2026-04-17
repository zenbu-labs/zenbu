import { describe, expect, it } from "vitest"
import {
  freezeWindow,
  getWindowedRange,
  loadNewerWindow,
  loadOlderWindow,
} from "../src/renderer/views/chat/lib/use-chat-events"

describe("windowed item helpers", () => {
  it("tracks the live tail by default", () => {
    expect(
      getWindowedRange(500, 200, { start: null, end: null }),
    ).toEqual({ start: 300, end: 500 })
  })

  it("freezes the visible tail once detached", () => {
    const frozen = freezeWindow(500, 200, { start: null, end: null })

    expect(frozen).toEqual({ start: 300, end: 500 })
    expect(getWindowedRange(525, 200, frozen)).toEqual({
      start: 300,
      end: 500,
    })
  })

  it("expands older content above without moving the tail", () => {
    const frozen = freezeWindow(500, 200, { start: null, end: null })

    expect(loadOlderWindow(500, 200, 100, frozen)).toEqual({
      start: 200,
      end: 500,
    })
  })

  it("expands newer content below without shrinking the current slice", () => {
    const frozen = { start: 200, end: 500 }

    expect(loadNewerWindow(560, 200, 100, frozen)).toEqual({
      start: 200,
      end: 560,
    })
  })
})
