import { describe, expect, it, vi } from "vitest";

import {
  clampPanelWidth,
  fitWorkspacePanelWidths,
  loadWorkspacePanelWidths,
  normalizePanelBounds,
  saveWorkspacePanelWidths,
  workspacePanelStorageKey,
  type WorkspacePanelBounds,
} from "./workspace-panel-state";

const bounds: WorkspacePanelBounds = {
  left: { defaultWidth: 280, minWidth: 200, maxWidth: 400 },
  right: { defaultWidth: 320, minWidth: 240, maxWidth: 480 },
};

describe("workspace panel state", () => {
  it("creates a project and document scoped storage key", () => {
    expect(workspacePanelStorageKey({ projectId: "demo/project", documentId: "screen:home" }))
      .toBe("design-space:workspace-panels:v1:demo%2Fproject:screen%3Ahome");
  });

  it("clamps persisted values and falls back when storage is invalid", () => {
    const values = new Map<string, string>([
      ["clamped", JSON.stringify({ version: 1, left: 120, right: 900 })],
      ["invalid", "not json"],
    ]);
    const storage = { getItem: (key: string) => values.get(key) ?? null };

    expect(loadWorkspacePanelWidths(storage, "clamped", bounds)).toEqual({ left: 200, right: 480 });
    expect(loadWorkspacePanelWidths(storage, "invalid", bounds)).toEqual({ left: 280, right: 320 });
    expect(loadWorkspacePanelWidths(storage, "missing", bounds)).toEqual({ left: 280, right: 320 });
  });

  it("normalizes contradictory bounds and protects against non-finite widths", () => {
    expect(normalizePanelBounds(
      { minWidth: 360, maxWidth: 200, defaultWidth: 900 },
      { minWidth: 100, maxWidth: 500, defaultWidth: 240 },
    )).toEqual({ minWidth: 360, maxWidth: 360, defaultWidth: 360 });
    expect(normalizePanelBounds(
      { minWidth: -100, maxWidth: 200, defaultWidth: -40 },
      { minWidth: 100, maxWidth: 500, defaultWidth: 240 },
    )).toEqual({ minWidth: 0, maxWidth: 200, defaultWidth: 0 });
    expect(clampPanelWidth(Number.NaN, { minWidth: 220, maxWidth: 440 })).toBe(220);
  });

  it("fits both panels while reserving a usable canvas", () => {
    const fitted = fitWorkspacePanelWidths({ left: 400, right: 480 }, bounds, 1024, 320);
    expect(fitted.left).toBeGreaterThanOrEqual(bounds.left.minWidth);
    expect(fitted.right).toBeGreaterThanOrEqual(bounds.right.minWidth);
    expect(fitted.left + fitted.right).toBeLessThanOrEqual(1024 - 320 - 2);
  });

  it("does not make unavailable storage fatal", () => {
    const storage = { setItem: vi.fn(() => { throw new DOMException("full"); }) };
    expect(() => saveWorkspacePanelWidths(storage, "key", { left: 280, right: 320 })).not.toThrow();
  });
});
