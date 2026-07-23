import { expect, it } from "vitest";

import type { RuntimeSourceWorkspaceEntry, SourceWorkspaceLayer } from "../../shared/source-workspace";
import { externalSourceLayerOwner, sourceLayerOwner } from "./source-layer-ownership";

const ownLayer: SourceWorkspaceLayer = {
  id: "own-root",
  kind: "html",
  label: "section",
  source: { start: 10, end: 20 },
  children: [],
};
const foreignLayer: SourceWorkspaceLayer = {
  id: "foreign-child",
  kind: "html",
  label: "button",
  source: { start: 30, end: 40 },
  children: [],
};
const current = entry("current", "src/Current.tsx", [ownLayer]);
const foreign = entry("foreign", "src/Foreign.tsx", [{
  id: "foreign-root",
  kind: "html",
  label: "nav",
  source: { start: 20, end: 50 },
  children: [foreignLayer],
}]);

it("finds the source entry that owns a nested layer", () => {
  expect(sourceLayerOwner([current, foreign], foreignLayer.id)).toEqual({
    entryId: "foreign",
    fileId: "foreign-file",
    label: "foreign",
    relativePath: "src/Foreign.tsx",
  });
});

it("only reports layers owned by a different source file as external", () => {
  expect(externalSourceLayerOwner(current, [current, foreign], ownLayer.id)).toBeUndefined();
  expect(externalSourceLayerOwner(current, [current, foreign], foreignLayer.id)?.entryId).toBe("foreign");
  expect(externalSourceLayerOwner(current, [current, foreign], "missing")).toBeUndefined();
});

function entry(
  id: string,
  relativePath: string,
  layers: readonly SourceWorkspaceLayer[],
): RuntimeSourceWorkspaceEntry {
  return {
    id,
    label: id,
    area: "components",
    device: "desktop",
    fileId: `${id}-file`,
    relativePath,
    exportName: id,
    props: [],
    slots: [],
    findings: [],
    source: { start: 0, end: 100 },
    layers,
    component: () => null,
  };
}
