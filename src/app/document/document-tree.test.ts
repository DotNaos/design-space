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
        slotId: "content",
        children: [{ kind: "html", id: "dom.0.0", tagName: "button" }],
      }],
    });

    expect(rows.filter((row) => row.kind === "internals-summary")).toMatchObject([
      { label: "Implementation" },
    ]);
    expect(rows.find((row) => row.kind === "component" && row.label === "Stack"))
      .toMatchObject({ internalHtml: { nodeCount: 2, collapsed: false } });
    expect(rows.filter((row) => row.kind === "html")).toMatchObject([
      { label: "section", depth: 3, selection: { id: "html:panel.template:dom.0" } },
      { label: "button", depth: 4, selection: { id: "html:panel.template:dom.0.0" } },
    ]);
    expect(rows.filter((row) => row.kind === "html-close")).toMatchObject([
      { label: "button", depth: 4 },
      { label: "section", depth: 3 },
    ]);
    const contentSlot = rows.find((row) => row.kind === "slot" && row.selection.slotId === "content");
    const sectionOpen = rows.findIndex((row) => row.kind === "html" && row.label === "section");
    const sectionClose = rows.findIndex((row) => row.kind === "html-close" && row.label === "section");
    expect(contentSlot).toMatchObject({ depth: 4 });
    expect(rows.indexOf(contentSlot!)).toBeGreaterThan(sectionOpen);
    expect(rows.indexOf(contentSlot!)).toBeLessThan(sectionClose);
  });

  it("keeps the component implementation and its root HTML disclosure independent", () => {
    const observed = {
      "panel.template": [{ kind: "html" as const, id: "dom.0", tagName: "section" }],
    };
    const collapsed = buildDesignDocumentTree(target, panel, [panel], new Set(), observed);
    const implementation = collapsed.find((row) => row.kind === "internals-summary");
    expect(implementation).toBeDefined();
    if (!implementation || implementation.kind !== "internals-summary") return;

    const implementationOnly = buildDesignDocumentTree(
      target,
      panel,
      [panel],
      new Set([implementation.disclosureId]),
      observed,
    );
    expect(implementationOnly.find((row) => row.kind === "internals-summary"))
      .toMatchObject({ collapsed: false });
    expect(implementationOnly.find((row) => row.kind === "component" && row.label === "Stack"))
      .toMatchObject({ internalHtml: { nodeCount: 1, collapsed: true } });
    expect(implementationOnly.filter((row) => row.kind === "html")).toHaveLength(0);

    const withRootHtml = buildDesignDocumentTree(
      target,
      panel,
      [panel],
      new Set([implementation.disclosureId, "panel.template"]),
      observed,
    );
    expect(withRootHtml.find((row) => row.kind === "internals-summary"))
      .toMatchObject({ collapsed: false });
    expect(withRootHtml.filter((row) => row.kind === "html"))
      .toMatchObject([{ selection: { id: "html:panel.template:dom.0" }, label: "section" }]);
  });

  it("reveals observed HTML for only the requested component instance", () => {
    const dashboard: DesignDocument = {
      schemaVersion: 2,
      id: "screen.dashboard",
      label: "Dashboard",
      kind: "screen",
      root: {
        instanceId: "root.stack",
        adapterId: "stack",
        slots: {
          content: [{
            kind: "component",
            node: { instanceId: "child.stack", adapterId: "stack", slots: { content: [] } },
          }],
        },
      },
    };
    const rows = buildDesignDocumentTree(target, dashboard, [], new Set(["child.stack"]), {
      "root.stack": [{ kind: "html", id: "root.dom", tagName: "main" }],
      "child.stack": [{ kind: "html", id: "child.dom", tagName: "section" }],
    });

    expect(rows.filter((row) => row.kind === "component")).toMatchObject([
      { selection: { id: "root.stack" }, internalHtml: { nodeCount: 1, collapsed: true } },
      { selection: { id: "child.stack" }, internalHtml: { nodeCount: 1, collapsed: false } },
    ]);
    expect(rows.filter((row) => row.kind === "html")).toMatchObject([
      { selection: { id: "html:child.stack:child.dom" }, label: "section" },
    ]);
  });
});
