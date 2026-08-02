import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import {
  clampSourceCodePanelHeight,
  sourceCodePanelBounds,
  SourceWorkspaceCodeOverlay,
} from "./SourceWorkspaceCodeOverlay";

afterEach(cleanup);

it("keeps the source tree visible while opening code as a second left panel", async () => {
  const onOpenChange = vi.fn();
  const { rerender } = render(
    <SourceWorkspaceCodeOverlay code={<div>Monaco code</div>} open={false} onOpenChange={onOpenChange}>
      <div>Source tree</div>
    </SourceWorkspaceCodeOverlay>,
  );

  expect(screen.getByText("Source tree")).toBeVisible();
  expect(screen.queryByText("Monaco code")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Code" }));
  expect(onOpenChange).toHaveBeenCalledWith(true);

  rerender(
    <SourceWorkspaceCodeOverlay code={<div>Monaco code</div>} open onOpenChange={onOpenChange}>
      <div>Source tree</div>
    </SourceWorkspaceCodeOverlay>,
  );
  expect(screen.getByText("Source tree")).toBeVisible();
  expect(screen.getByText("Monaco code")).toBeVisible();
  expect(screen.getByRole("region", { name: "Source code panel" })).toHaveStyle({ height: "44%" });
  expect(screen.getByRole("separator", { name: "Resize code panel" })).toBeVisible();
});

it("combines the code panel toggle and file controls in one header", () => {
  render(
    <SourceWorkspaceCodeOverlay
      code={<div>Monaco code</div>}
      header={<div>App Source Design file Editable</div>}
      open
      onOpenChange={vi.fn()}
    >
      <div>Source tree</div>
    </SourceWorkspaceCodeOverlay>,
  );

  const panel = screen.getByRole("region", { name: "Source code panel" });
  expect(screen.getByRole("button", { name: "Collapse code" })).toBeVisible();
  expect(screen.getByText("App Source Design file Editable").parentElement).toBe(panel.firstElementChild?.nextElementSibling);
});

it("resizes the open panel with the keyboard and resets it by double-click", () => {
  const onHeightChange = vi.fn();
  render(
    <SourceWorkspaceCodeOverlay
      code={<div>Monaco code</div>}
      height={320}
      open
      onHeightChange={onHeightChange}
      onOpenChange={vi.fn()}
    >
      <div>Source tree</div>
    </SourceWorkspaceCodeOverlay>,
  );

  const separator = screen.getByRole("separator", { name: "Resize code panel" });
  const container = screen.getByRole("region", { name: "Source code panel" }).parentElement;
  expect(container).not.toBeNull();
  if (!container) throw new Error("Expected source code overlay container.");
  Object.defineProperty(container, "clientHeight", { configurable: true, value: 800 });
  fireEvent.keyDown(separator, { key: "ArrowUp" });
  expect(onHeightChange).toHaveBeenLastCalledWith(336);

  fireEvent.doubleClick(separator);
  expect(onHeightChange).toHaveBeenLastCalledWith(undefined);
});

it("keeps resize heights within the tree and code panel limits", () => {
  const bounds = sourceCodePanelBounds(800);
  expect(bounds).toEqual({ min: 224, max: 680 });
  expect(clampSourceCodePanelHeight(100, bounds)).toBe(224);
  expect(clampSourceCodePanelHeight(900, bounds)).toBe(680);
});
