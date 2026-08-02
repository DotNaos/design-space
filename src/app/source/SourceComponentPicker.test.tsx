import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import type { SourceWorkspaceLayer } from "../../shared/source-workspace";
import { SourceComponentPicker } from "./SourceComponentPicker";

afterEach(cleanup);

it("searches compatible components and applies the active result from the keyboard", async () => {
  const onApply = vi.fn();
  render(
    <SourceComponentPicker
      candidates={[
        { id: "notice", name: "StatusNotice", group: "Project components", source: "src/StatusNotice.tsx", compatible: true, insertable: true, deviceState: "available" },
        { id: "card", name: "Card", group: "Project components", source: "src/Card.tsx", compatible: false, insertable: false, explanation: "Expected StatusNotice.", deviceState: "available" },
      ]}
      slot={missingSlot}
      onApply={onApply}
    />,
  );

  const trigger = screen.getByRole("button", { name: "Add to notice slot" });
  expect(trigger).not.toHaveTextContent("Add");
  expect(trigger).not.toHaveTextContent("Replace");
  await userEvent.click(trigger);
  const search = await screen.findByRole("combobox", { name: "Search compatible components" });
  await userEvent.type(search, "status{Enter}");
  expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ name: "StatusNotice" }), "add");
  expect(screen.queryByRole("combobox", { name: "Search compatible components" })).not.toBeInTheDocument();
});

it("explains the accepted types when search has no compatible result", async () => {
  render(<SourceComponentPicker candidates={[]} slot={missingSlot} onApply={() => undefined} />);
  await userEvent.click(screen.getByRole("button", { name: "Add to notice slot" }));
  expect(await screen.findByText("This slot accepts StatusNotice.")).toBeVisible();
});

it("uses a full-size purple insertion target and applies a compatible component on the canvas", async () => {
  const onApply = vi.fn();
  render(
    <SourceComponentPicker
      appearance="canvas"
      candidates={[
        { id: "notice", name: "StatusNotice", group: "Project components", source: "src/StatusNotice.tsx", compatible: true, insertable: true, deviceState: "available" },
      ]}
      slot={missingSlot}
      onApply={onApply}
    />,
  );
  const trigger = screen.getByRole("button", { name: "Add to notice slot" });
  expect(trigger).toHaveClass("h-full", "w-full", "bg-transparent");
  expect(trigger).toHaveTextContent("notice");
  expect(trigger.querySelector("svg")).not.toBeNull();
  await userEvent.click(trigger);
  await userEvent.click(await screen.findByRole("button", { name: "StatusNotice, compatible" }));
  expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ name: "StatusNotice" }), "add");
});

const missingSlot: SourceWorkspaceLayer = {
  id: "slot.notice",
  label: "notice",
  kind: "slot",
  source: { start: 10, end: 10 },
  children: [],
  slot: {
    contract: { name: "notice", type: 'ComponentSlot<"StatusNotice">', required: true, multiple: false, accepts: ["StatusNotice"], min: 1, max: 1 },
    validity: "missing",
    received: [],
    edit: { kind: "single", insertAt: 10, value: { start: 10, end: 20 } },
  },
};
