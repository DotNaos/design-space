import { expect, it } from "vitest";

import type { RuntimeSourceWorkspaceEntry, SourceWorkspaceLayer } from "../../shared/source-workspace";
import { sourceEntrySlotLayers } from "./source-entry-layers";

it("includes rendered slots without a composition contract", () => {
  const renderedSlot: SourceWorkspaceLayer = {
    id: "slot.content",
    label: "content",
    kind: "slot",
    source: { start: 10, end: 20 },
    children: [],
  };
  const entry = {
    id: "shell",
    label: "Shell",
    area: "layout",
    device: "desktop",
    fileId: "shell-file",
    relativePath: "src/app/Shell.tsx",
    exportName: "Shell",
    props: [],
    slots: [],
    findings: [],
    source: { start: 0, end: 30 },
    component: () => null,
    layers: [{
      id: "layout",
      label: "main",
      kind: "html",
      source: { start: 0, end: 30 },
      children: [renderedSlot],
    }],
  } satisfies RuntimeSourceWorkspaceEntry;

  expect(sourceEntrySlotLayers(entry)).toEqual([renderedSlot]);
});
