import { describe, expect, it } from "vitest";

import { shouldOpenSlotPicker, slotHasCapacity } from "./slot-capacity";

describe("slot insertion capacity", () => {
  it("supports additional children in Insert mode until a declared maximum is reached", () => {
    expect(shouldOpenSlotPicker({}, 1, true)).toBe(true);
    expect(shouldOpenSlotPicker({ max: 3 }, 1, true)).toBe(true);
    expect(shouldOpenSlotPicker({ max: 1 }, 1, true)).toBe(false);
    expect(shouldOpenSlotPicker({}, 1, false)).toBe(false);
    expect(shouldOpenSlotPicker({}, 0, false)).toBe(true);
    expect(slotHasCapacity({ max: 2 }, 2)).toBe(false);
  });
});
