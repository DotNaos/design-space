import { describe, expect, it } from "vitest";

import type { ComponentTreeRow } from "../../model";
import { buildSelectionNavigation, navigateSelection, requiredTreeDisclosures } from "./selection-navigation";

describe("selection navigation", () => {
  it("navigates the expanded hierarchy without activating targets", () => {
    const index = buildSelectionNavigation(rows);
    expect(navigateSelection(index, "root", "child")?.id).toBe("html:root:surface");
    expect(navigateSelection(index, "html:root:surface", "child")?.id).toBe("slot:root:content");
    expect(navigateSelection(index, "slot:root:content", "parent")?.id).toBe("html:root:surface");
    expect(navigateSelection(index, "slot:root:content", "next-sibling")?.id).toBe("slot:root:actions");
    expect(navigateSelection(index, "slot:root:actions", "previous-sibling")?.id).toBe("slot:root:content");
  });

  it("returns no target at hierarchy boundaries", () => {
    const index = buildSelectionNavigation(rows);
    expect(navigateSelection(index, "root", "parent")).toBeUndefined();
    expect(navigateSelection(index, "slot:root:content", "child")).toBeUndefined();
    expect(navigateSelection(index, "slot:root:actions", "next-sibling")).toBeUndefined();
  });

  it("preserves the disclosures required by hidden HTML", () => {
    const index = buildSelectionNavigation(rows);
    expect([...requiredTreeDisclosures(index, "slot:root:content")]).toEqual(["root"]);
  });
});

const rows: readonly ComponentTreeRow[] = [
  { kind: "component", depth: 0, label: "Root", selection: { kind: "component", id: "root" } },
  {
    kind: "html", depth: 1, label: "div", selfClosing: false,
    selection: { kind: "html", id: "html:root:surface", componentInstanceId: "root", nodeId: "surface" },
  },
  {
    kind: "slot", depth: 2, label: "Content", occupied: false, childCount: 0,
    selection: { kind: "slot", id: "slot:root:content", componentInstanceId: "root", slotId: "content" },
  },
  {
    kind: "slot", depth: 2, label: "Actions", occupied: false, childCount: 0,
    selection: { kind: "slot", id: "slot:root:actions", componentInstanceId: "root", slotId: "actions" },
  },
  { kind: "html-close", depth: 1, label: "div", id: "html:root:surface" },
];
