import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";

import { useSourceLibraryRuntime } from "./useSourceLibraryRuntime";

beforeEach(() => localStorage.clear());

it("keeps the library in development mode while Installed is unavailable", () => {
  localStorage.setItem("design-space.library-source", "release");
  const { result } = renderHook(() => useSourceLibraryRuntime());

  expect(result.current.mode).toBe("development");
  expect(localStorage.getItem("design-space.library-source")).toBe("development");
  act(() => result.current.setMode("release"));
  expect(result.current.mode).toBe("development");
  expect(localStorage.getItem("design-space.library-source")).toBe("development");
});
