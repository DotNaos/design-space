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

it("attaches the component definition contract to an isolated slot placeholder", () => {
  const renderedSlot: SourceWorkspaceLayer = {
    id: "slot.status",
    label: "status",
    kind: "slot",
    source: { start: 10, end: 20 },
    children: [],
  };
  const contract = {
    name: "status",
    type: "ComponentSlot<typeof WorkspaceStatus>",
    required: true,
    multiple: false,
    accepts: ["WorkspaceStatus"],
    min: 1,
    max: 1,
  } as const;
  const entry = {
    ...sourceEntry(),
    slots: [contract],
    layers: [renderedSlot],
  };

  expect(sourceEntrySlotLayers(entry)).toEqual([{ ...renderedSlot, slotContract: contract }]);
});

it("turns a component-only root into one default content slot", () => {
  const child: SourceWorkspaceLayer = {
    id: "workspace-shell",
    label: "WorkspaceShell",
    kind: "component",
    source: { start: 10, end: 20 },
    children: [{
      id: "descendant-slot",
      label: "status",
      kind: "slot",
      source: { start: 12, end: 14 },
      children: [],
      slot: {
        contract: { name: "status", type: "ComponentSlot<Status>", required: true, multiple: false, accepts: ["Status"], min: 1, max: 1 },
        validity: "valid",
        received: ["Status"],
        edit: { kind: "single", insertAt: 12 },
      },
    }],
  };
  const entry = { ...sourceEntry(), layers: [child] };

  expect(sourceEntrySlotLayers(entry)).toEqual([expect.objectContaining({
    id: `${entry.id}:design-slot:content`,
    label: "content",
    children: [child],
  })]);
});

it("gives a leaf component a default content slot", () => {
  const entry = { ...sourceEntry(), layers: [{
    id: "leaf",
    label: "button",
    kind: "html" as const,
    source: { start: 0, end: 10 },
    children: [],
  }] };

  expect(sourceEntrySlotLayers(entry)).toEqual([expect.objectContaining({
    id: `${entry.id}:design-slot:content`,
    label: "content",
  })]);
});

function sourceEntry(): RuntimeSourceWorkspaceEntry {
  return {
    id: "app",
    label: "App",
    area: "pages",
    device: "desktop",
    fileId: "app-file",
    relativePath: "src/app/App.tsx",
    exportName: "App",
    props: [],
    slots: [],
    findings: [],
    source: { start: 0, end: 30 },
    component: () => null,
  };
}
