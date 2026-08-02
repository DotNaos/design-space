import { expect, it } from "vitest";

import type { RuntimeSourceWorkspaceEntry } from "../../shared/source-workspace";
import type { SourceFocusGraph, SourceOccurrence } from "./source-focus-tree";
import { approvedSourceComponentCount, sourceComponentReviewSequence } from "./source-component-review";

function entry(id: string): RuntimeSourceWorkspaceEntry {
  return {
    id,
    label: id,
    area: "components",
    device: "desktop",
    fileId: `file.${id}`,
    relativePath: `src/${id}.tsx`,
    exportName: id,
    props: [],
    slots: [],
    findings: [],
    source: { start: 0, end: 1 },
    component: () => null,
  };
}

function occurrence(id: string, current: RuntimeSourceWorkspaceEntry, children: string[]): SourceOccurrence {
  return {
    id,
    node: { id: current.id, label: current.label, area: current.area, entries: [current], implementations: {} } as never,
    entry: current,
    children,
  };
}

it("walks component definitions depth-first and reviews a shared definition once", () => {
  const root = entry("Root");
  const shared = entry("SharedButton");
  const main = entry("Main");
  const graph: SourceFocusGraph = {
    roots: ["root"],
    occurrences: new Map([
      ["root", occurrence("root", root, ["shared.first", "main"])],
      ["shared.first", occurrence("shared.first", shared, [])],
      ["main", occurrence("main", main, ["shared.second"])],
      ["shared.second", occurrence("shared.second", shared, [])],
    ]),
  };

  const sequence = sourceComponentReviewSequence(graph);
  expect(sequence.map(({ entry: current }) => current.id)).toEqual(["Root", "SharedButton", "Main"]);
  expect(approvedSourceComponentCount({
    status: "verified",
    components: {
      Root: { scopeId: "root", label: "Root", state: "approved", attestation: "ok" },
      Main: { scopeId: "main", label: "Main", state: "missing", attestation: "" },
    },
  }, sequence)).toBe(1);
});
