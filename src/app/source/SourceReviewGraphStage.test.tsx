import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import type { RuntimeSourceWorkspaceEntry, SourceWorkspaceLayer } from "../../shared/source-workspace";
import { SourceReviewGraphStage } from "./SourceReviewGraphStage";
import { sourceReviewGraphProperties, sourceReviewGraphSlots } from "./source-review-graph";

afterEach(cleanup);

it("cycles through arbitrary declared design cases instead of assuming named statuses", async () => {
  const onCaseChange = vi.fn();
  render(
    <SourceReviewGraphStage
      graph={{
        caseNames: ["default", "dense navigation", "signed checkpoint", "empty workspace"],
        componentLabel: "WorkspaceShell",
        isStateful: true,
        properties: [],
        selectedCase: "dense navigation",
        slots: [],
        onCaseChange,
      }}
      layout="vertical"
    />,
  );

  expect(screen.getByTestId("source-review-case-carousel")).toHaveTextContent("dense navigation");
  expect(screen.getByTestId("source-review-case-carousel")).toHaveTextContent("2/4");
  await userEvent.click(screen.getByRole("button", { name: "Next design case" }));
  expect(onCaseChange).toHaveBeenCalledWith("signed checkpoint");
  await userEvent.click(screen.getByRole("button", { name: "Previous design case" }));
  expect(onCaseChange).toHaveBeenCalledWith("default");
});

it("shows current property values and occupied slot children", async () => {
  const onSelectSlot = vi.fn();
  render(
    <SourceReviewGraphStage
      graph={{
        caseNames: ["default"],
        componentLabel: "Layout",
        isStateful: false,
        properties: [{ name: "density", required: true, type: "Density", value: "compact" }],
        selectedCase: "default",
        slots: [{
          accepts: ["Sidebar", "Navigation"],
          active: true,
          children: ["Sidebar"],
          count: 1,
          id: "sidebar-slot",
          label: "sidebar",
          max: 1,
          min: 1,
        }],
        onSelectSlot,
      }}
      layout="horizontal"
    />,
  );

  expect(screen.getByText("density").parentElement).toHaveTextContent("compact");
  expect(screen.getByRole("button", { name: "Select sidebar slot" })).toHaveTextContent("Sidebar");
  expect(screen.getByRole("button", { name: "Select sidebar slot" })).toHaveAttribute("data-slot-occupancy", "1");
  await userEvent.click(screen.getByRole("button", { name: "Select sidebar slot" }));
  expect(onSelectSlot).toHaveBeenCalledWith("sidebar-slot");
});

it("derives values and slot occupancy from the source model", () => {
  const entry = {
    id: "layout",
    label: "Layout",
    area: "layout",
    device: "desktop",
    fileId: "layout-file",
    relativePath: "src/Layout.tsx",
    exportName: "Layout",
    props: [{ name: "density", type: '"compact" | "comfortable"', required: true, kind: "string" }],
    slots: [{ name: "sidebar", type: "Sidebar", required: true, multiple: false, accepts: ["Sidebar"], min: 1, max: 1 }],
    findings: [],
    source: { start: 0, end: 1 },
    component: () => null,
  } satisfies RuntimeSourceWorkspaceEntry;
  const slot = {
    id: "sidebar-slot",
    label: "sidebar",
    kind: "slot",
    source: { start: 2, end: 3 },
    children: [{
      id: "sidebar-child",
      label: "Sidebar",
      kind: "component",
      source: { start: 4, end: 5 },
      children: [],
    }],
    slotContract: entry.slots[0],
  } satisfies SourceWorkspaceLayer;

  expect(sourceReviewGraphProperties({
    caseValues: { density: "compact" },
    defaults: { density: "comfortable" },
    entry,
  })).toEqual([{ name: "density", required: true, type: '"compact" | "comfortable"', value: "compact" }]);
  expect(sourceReviewGraphSlots({ entry, selectedLayerId: slot.id, slotLayers: [slot] })).toEqual([{
    accepts: ["Sidebar"],
    active: true,
    children: ["Sidebar"],
    count: 1,
    id: "sidebar-slot",
    label: "sidebar",
    max: 1,
    min: 1,
  }]);
});
