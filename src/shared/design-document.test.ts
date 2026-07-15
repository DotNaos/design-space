import { describe, expect, it } from "vitest";

import { designDocumentSchema } from "./design-document";
import { strictUiStatus } from "./strict-ui";

const screen = {
  schemaVersion: 2,
  id: "screen.dashboard",
  label: "Dashboard",
  kind: "screen",
  root: {
    instanceId: "dashboard.card",
    adapterId: "card",
    props: { className: "p-6", compact: false, columns: 2 },
    slots: { body: [] },
  },
} as const;

describe("design document contract", () => {
  it("accepts a target-neutral screen graph with JSON properties", () => {
    expect(designDocumentSchema.parse(screen)).toEqual(screen);
  });

  it("accepts a deliberately empty page without a root component", () => {
    expect(designDocumentSchema.parse({ ...screen, root: null })).toEqual({ ...screen, root: null });
  });

  it("rejects duplicate public React prop names in a component contract", () => {
    expect(designDocumentSchema.safeParse({
      schemaVersion: 2,
      id: "component.duplicate-props",
      label: "Duplicate props",
      kind: "component",
      component: {
        id: "duplicate-props",
        label: "Duplicate props",
        group: "Custom",
        properties: [
          { id: "title", label: "Title", prop: "content", kind: "text" },
          { id: "body", label: "Body", prop: "content", kind: "text" },
        ],
        slots: [],
      },
      root: { instanceId: "duplicate.root", adapterId: "text", slots: {} },
    }).success).toBe(false);
  });

  it("rejects browser-shaped property keys outside the opaque contract", () => {
    expect(designDocumentSchema.safeParse({
      schemaVersion: 2,
      id: "screen.invalid-prop",
      label: "Invalid prop",
      kind: "screen",
      root: { instanceId: "invalid.root", adapterId: "text", props: { "bad prop": "value" }, slots: {} },
    }).success).toBe(false);
  });

  it("requires component definitions and valid select property options", () => {
    expect(() => designDocumentSchema.parse({ ...screen, kind: "component" })).toThrow();
    expect(() => designDocumentSchema.parse({
      ...screen,
      kind: "component",
      component: {
        id: "summary",
        label: "Summary",
        group: "Surfaces",
        properties: [{ id: "tone", label: "Tone", prop: "tone", kind: "select", options: [] }],
        slots: [],
      },
    })).toThrow();
  });

  it("rejects executable or path-like extra browser fields", () => {
    expect(() => designDocumentSchema.parse({ ...screen, command: "rm -rf" })).toThrow();
    expect(() => designDocumentSchema.parse({ ...screen, rootPath: "/tmp/project" })).toThrow();
  });
});

describe("Strict UI evidence status", () => {
  it("blocks on errors and preserves warning-only states", () => {
    expect(strictUiStatus([])).toBe("passed");
    expect(strictUiStatus([{ ruleId: "token.raw", severity: "warning", message: "Prefer a token", location: { kind: "document" } }])).toBe("warnings");
    expect(strictUiStatus([{ ruleId: "slot.required", severity: "error", message: "Missing body", location: { kind: "document" } }])).toBe("blocked");
  });
});
