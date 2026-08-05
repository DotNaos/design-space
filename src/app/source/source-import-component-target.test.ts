import { expect, it } from "vitest";

import type { SourceWorkspaceEntry } from "../../shared/source-workspace";
import { sourceImportedComponentTarget } from "./source-import-component-target";

const currentEntry = entry({
  id: "shadcn-checkbox",
  exportName: "ShadcnCheckbox",
  relativePath: "src/adapters/component-library/checkbox/mapping/shadcn/ShadcnCheckbox.tsx",
});
const targetEntry = entry({
  id: "checkbox",
  exportName: "Checkbox",
  relativePath: "src/adapters/shadcn/checkbox.tsx",
  layerId: "checkbox-root",
});

it("resolves an aliased component import through a barrel directory", () => {
  expect(sourceImportedComponentTarget({
    currentEntry,
    entries: [currentEntry, targetEntry],
    layer: {
      id: "base-checkbox-use",
      label: "BaseCheckbox",
      kind: "component",
      source: { start: 80, end: 120 },
      children: [],
    },
    source: 'import { Checkbox as BaseCheckbox } from "../../../../shadcn";',
  })).toEqual({ entry: targetEntry, layerId: "checkbox-root" });
});

it("does not offer a target for an unknown component", () => {
  expect(sourceImportedComponentTarget({
    currentEntry,
    entries: [currentEntry, targetEntry],
    layer: {
      id: "unknown-use",
      label: "Unknown",
      kind: "component",
      source: { start: 80, end: 120 },
      children: [],
    },
    source: 'import { Checkbox as BaseCheckbox } from "../../../../shadcn";',
  })).toBeUndefined();
});

function entry(input: {
  id: string;
  exportName: string;
  relativePath: string;
  layerId?: string;
}): SourceWorkspaceEntry {
  return {
    id: input.id,
    label: input.exportName,
    area: "components",
    device: "desktop",
    fileId: `${input.id}-file`,
    relativePath: input.relativePath,
    exportName: input.exportName,
    props: [],
    slots: [],
    findings: [],
    source: { start: 0, end: 100 },
    layers: input.layerId ? [{
      id: input.layerId,
      label: "div",
      kind: "html",
      source: { start: 20, end: 80 },
      children: [],
    }] : [],
  };
}
