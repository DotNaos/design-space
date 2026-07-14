import { describe, expect, it } from "vitest";

import type { DesignDocument } from "../../shared/design-document";
import type { TargetModule } from "../../shared/target-module";
import { buildDesignDocumentTree } from "./document-tree";

const target: TargetModule = {
  project: { id: "demo", label: "Demo" },
  defaultAdapterId: "stack",
  defaultFixture: { instanceId: "root", adapterId: "stack", slots: { content: [] } },
  files: [],
  adapters: [{
    component: { id: "stack", label: "Stack", group: "Layout", slots: [{ id: "content", label: "Content" }] },
    render: () => null,
  }],
};

const panel: DesignDocument = {
  schemaVersion: 2,
  id: "component.panel",
  label: "Panel",
  kind: "component",
  component: {
    id: "panel",
    label: "Panel",
    group: "Surfaces",
    properties: [],
    slots: [{ id: "body", label: "Body" }],
  },
  root: {
    instanceId: "panel.template",
    adapterId: "stack",
    slots: { content: [{ kind: "slot-outlet", id: "panel.body.outlet", slotId: "body" }] },
  },
};

describe("component document tree", () => {
  it("keeps public slots visible while the implementation is collapsed", () => {
    const rows = buildDesignDocumentTree(target, panel, [panel], false);

    expect(rows.map((row) => row.kind === "text" ? row.label : row.label)).toEqual([
      "Panel",
      "Body slot · outlet linked",
      "Implementation",
    ]);
    expect(rows[1]).toMatchObject({
      kind: "slot-outlet",
      selection: { outletId: "panel.body.outlet", slotId: "body" },
    });
    expect(rows[2]).toMatchObject({ kind: "internals-summary", collapsed: true });
  });

  it("reveals the target-owned implementation on demand", () => {
    const rows = buildDesignDocumentTree(target, panel, [panel], true);

    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "component", label: "Stack", depth: 2 }),
      expect.objectContaining({ kind: "slot", label: "Content", depth: 3 }),
    ]));
  });

  it("shows a missing public outlet instead of hiding the slot", () => {
    const missing = { ...panel, root: { ...panel.root, slots: { content: [] } } };

    expect(buildDesignDocumentTree(target, missing, [missing], false)).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "text", label: "Body slot · outlet missing" }),
    ]));
  });

  it("uses the observed preview DOM when an adapter has undeclared HTML wrappers", () => {
    const rows = buildDesignDocumentTree(target, panel, [panel], true, {
      "panel.template": [{
        kind: "html",
        id: "dom.0",
        tagName: "section",
        children: [{ kind: "html", id: "dom.0.0", tagName: "button" }],
      }],
    });

    expect(rows.filter((row) => row.kind === "html")).toMatchObject([
      { label: "section", depth: 4, selection: { id: "html:panel.template:dom.0" } },
      { label: "button", depth: 5, selection: { id: "html:panel.template:dom.0.0" } },
    ]);
  });
});
