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

  await userEvent.click(screen.getByRole("button", { name: "Add to notice slot" }));
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
