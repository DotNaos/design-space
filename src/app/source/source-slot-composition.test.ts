import { describe, expect, it } from "vitest";

import type { SourceWorkspaceLayer } from "../../shared/source-workspace";
import { applySourceSlotCandidate, filterSourceSlotCandidates, moveSourceSlotChild, removeSourceSlotChild } from "./source-slot-composition";

describe("typed source slot composition", () => {
  it("inserts a compatible component and its import without inventing props", () => {
    const source = "export function App() { return <Panel slots={{ header: <Heading /> }} />; }\n";
    const insertAt = source.indexOf(" }}");
    const result = applySourceSlotCandidate(source, "src/App.tsx", slot({
      kind: "missing-property",
      insertAt,
    }), {
      id: "button",
      name: "Button",
      group: "Project components",
      source: "src/components/Button.tsx",
      importSource: "./components/Button",
      exportName: "Button",
      compatible: true,
      insertable: true,
      deviceState: "available",
    }, "add");

    expect(result.source).toContain('import { Button } from "./components/Button";');
    expect(result.source).toContain("header: <Heading />, actions: [<Button />]");
    expect(result.source.slice(result.selection.start, result.selection.end)).toBe("<Button />");
  });

  it("reuses an existing trailing comma when it inserts a missing slot property", () => {
    const source = "export function App() { return <Panel slots={{ header: <Heading />, }} />; }\n";
    const insertAt = source.indexOf(" }}");
    const result = applySourceSlotCandidate(source, "src/App.tsx", slot({
      kind: "missing-property",
      insertAt,
    }), {
      id: "button",
      name: "Button",
      group: "Project components",
      source: "src/components/Button.tsx",
      importSource: "./components/Button",
      exportName: "Button",
      compatible: true,
      insertable: true,
      deviceState: "available",
    }, "add");

    expect(result.source).toContain("header: <Heading />, actions: [<Button />]");
    expect(result.source).not.toContain("/>,, actions");
  });

  it("filters by name, group, and source while hiding incompatible items by default", () => {
    const candidates = [
      { id: "1", name: "Button", group: "Actions", source: "src/Button.tsx", compatible: true, insertable: true, deviceState: "available" as const },
      { id: "2", name: "Card", group: "Surfaces", source: "src/Card.tsx", compatible: false, insertable: false, deviceState: "available" as const },
    ];
    expect(filterSourceSlotCandidates(candidates, "actions", false).map((item) => item.name)).toEqual(["Button"]);
    expect(filterSourceSlotCandidates(candidates, "card", false)).toEqual([]);
    expect(filterSourceSlotCandidates(candidates, "surfaces", true).map((item) => item.name)).toEqual(["Card"]);
  });

  it("reorders and removes multiple slot items without violating the minimum", () => {
    const source = "<Panel slots={{ actions: [<Alpha />, <Beta />] }} />";
    const alpha = source.indexOf("<Alpha />");
    const beta = source.indexOf("<Beta />");
    const listStart = source.indexOf("[", source.indexOf("actions")) + 1;
    const listEnd = source.indexOf("]", listStart);
    const base = slot({ kind: "list", insertAt: listEnd, value: { start: listStart - 1, end: listEnd + 1 }, list: { start: listStart, end: listEnd } });
    let layer: SourceWorkspaceLayer = {
      ...base,
      children: [
        { id: "alpha", label: "Alpha", kind: "component", source: { start: alpha, end: alpha + 9 }, children: [] },
        { id: "beta", label: "Beta", kind: "component", source: { start: beta, end: beta + 8 }, children: [] },
      ],
      slot: { ...base.slot!, received: ["Alpha", "Beta"], contract: { ...base.slot!.contract, min: 1 } },
    };

    expect(moveSourceSlotChild(source, layer, 1, -1).source).toContain("[<Beta />, <Alpha />]");
    const removed = removeSourceSlotChild(source, layer, 0);
    expect(removed.source).toContain("[<Beta />]");
    layer = { ...layer, slot: { ...layer.slot!, received: ["Alpha"] } };
    expect(() => removeSourceSlotChild(source, layer, 0)).toThrow("requires at least 1 item");
  });
});

function slot(edit: NonNullable<SourceWorkspaceLayer["slot"]>["edit"]): SourceWorkspaceLayer {
  return {
    id: "slot.actions",
    label: "actions",
    kind: "slot",
    source: { start: edit.insertAt, end: edit.insertAt },
    children: [],
    slot: {
      contract: { name: "actions", type: "ComponentSlotList<typeof Button>", required: false, multiple: true, accepts: ["Button"], min: 0 },
      validity: "optional",
      received: [],
      edit,
    },
  };
}
