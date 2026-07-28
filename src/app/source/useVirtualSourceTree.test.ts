import { expect, it } from "vitest";

import {
  sourceTreeAnchorDirections,
  sourceTreeOffscreenDirection,
  virtualSourceTreeWindow,
} from "./useVirtualSourceTree";

it("renders only a bounded source-tree window with scroll overscan", () => {
  expect(virtualSourceTreeWindow(1_000, 0, 400)).toEqual({
    start: 0,
    end: 18,
  });
  expect(virtualSourceTreeWindow(1_000, 20_000, 400)).toEqual({
    start: 492,
    end: 518,
  });
  expect(virtualSourceTreeWindow(1_000, 39_800, 400)).toEqual({
    start: 987,
    end: 1_000,
  });
});

it("points toward an active source row outside the viewport", () => {
  expect(sourceTreeOffscreenDirection(2, 200, 240)).toBe("above");
  expect(sourceTreeOffscreenDirection(20, 200, 240)).toBe("below");
  expect(sourceTreeOffscreenDirection(7, 200, 240)).toBeUndefined();
});

it("tracks the active component and selected layer independently", () => {
  expect(sourceTreeAnchorDirections(2, 20, 200, 240)).toEqual({
    active: "above",
    selected: "below",
  });
  expect(sourceTreeAnchorDirections(2, 2, 200, 240)).toEqual({
    active: "above",
    selected: undefined,
  });
});
