import { expect, it } from "vitest";

import type { ComponentDesignDefinition } from "../../../shared/component-design";
import type { RuntimeSourceWorkspaceEntry, SourceWorkspaceLayer } from "../../../shared/source-workspace";
import { renderStaticSourcePreviewMarkup } from "../../source/source-static-preview";
import { WorkspaceShell } from ".";
import design from "./index.design";

it("uses the standard canvas placeholders for its slots", async () => {
  const slotLayers = ["status", "content", "toolbar"].map((label, index): SourceWorkspaceLayer => ({
    id: `slot.${label}`,
    label,
    kind: "slot",
    source: { start: index * 10, end: index * 10 + 5 },
    children: [],
  }));
  const entry = {
    id: "WorkspaceShell",
    label: "WorkspaceShell",
    area: "layout",
    device: "desktop",
    fileId: "workspace-shell-file",
    relativePath: "src/app/components/WorkspaceShell/index.tsx",
    exportName: "WorkspaceShell",
    props: [],
    slots: [],
    findings: [],
    source: { start: 0, end: 100 },
    layers: slotLayers,
    component: () => null,
  } satisfies RuntimeSourceWorkspaceEntry;

  const markup = await renderStaticSourcePreviewMarkup({
    caseName: "default",
    definition: design as unknown as ComponentDesignDefinition,
    entry,
    matrix: false,
    slotLayers,
  });
  const container = document.createElement("div");
  container.innerHTML = markup;

  expect(design.defaults).toEqual({});
  for (const slot of slotLayers) {
    const target = container.querySelector(`[data-design-space-source-slot-name="${slot.label}"]`);
    expect(target).toHaveTextContent(slot.label);
    expect(target).toHaveAttribute("data-design-space-source-layer-id", slot.id);
  }
  expect(container).not.toHaveTextContent("Source tree");
});
