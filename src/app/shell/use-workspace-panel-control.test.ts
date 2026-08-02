import { expect, it, vi } from "vitest";

import { applyWorkspacePanelControl } from "./use-workspace-panel-control";

it("applies open and close commands directly to panel state", () => {
  const setVisible = vi.fn();
  const toggle = vi.fn();
  const actions = { setVisible, toggle };

  applyWorkspacePanelControl(
    { type: "workspace-panel", side: "right", action: "open", scope: "top" },
    actions,
  );
  applyWorkspacePanelControl(
    { type: "workspace-panel", side: "left", action: "close", scope: "top" },
    actions,
  );

  expect(setVisible).toHaveBeenNthCalledWith(1, "right", true);
  expect(setVisible).toHaveBeenNthCalledWith(2, "left", false);
  expect(toggle).not.toHaveBeenCalled();
});

it("uses the current state for toggle commands", () => {
  const setVisible = vi.fn();
  const toggle = vi.fn();

  applyWorkspacePanelControl(
    { type: "workspace-panel", side: "left", action: "toggle", scope: "top" },
    { setVisible, toggle },
  );

  expect(toggle).toHaveBeenCalledWith("left");
  expect(setVisible).not.toHaveBeenCalled();
});
