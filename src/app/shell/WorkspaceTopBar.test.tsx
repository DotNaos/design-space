import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkspaceTopBar } from "./WorkspaceTopBar";

afterEach(cleanup);

function renderTopBar(overrides: Partial<Parameters<typeof WorkspaceTopBar>[0]> = {}) {
  const props: Parameters<typeof WorkspaceTopBar>[0] = {
    targetLabel: "Demo target",
    documentLabel: "Quarterly planning",
    breadcrumb: ["App", "Pages", "Desktop", "Quarterly planning"],
    connected: true,
    checking: false,
    canUndo: true,
    canRedo: true,
    canReset: true,
    canStrictUi: true,
    canDiff: true,
    canSave: true,
    saving: false,
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onReset: vi.fn(),
    onStrictUi: vi.fn(),
    onDiff: vi.fn(),
    onSave: vi.fn(),
    ...overrides,
  };
  render(<WorkspaceTopBar {...props} />);
  return props;
}

describe("WorkspaceTopBar", () => {
  it("shows project context and local status without a product wordmark", () => {
    renderTopBar();

    expect(screen.getByText("Demo target")).toBeInTheDocument();
    expect(screen.getByLabelText("Current document path")).toHaveTextContent("AppPagesDesktopQuarterly planning");
    expect(screen.getByRole("status", { name: "Local preview connected" })).toBeInTheDocument();
    expect(screen.queryByText("Design Space")).not.toBeInTheDocument();
  });

  it("removes the mode switch and keeps strict UI, diff, and save actions available", async () => {
    const props = renderTopBar();

    await userEvent.click(screen.getByRole("button", { name: "Strict UI not checked" }));
    await userEvent.click(screen.getByRole("button", { name: "Prepare exact diff" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.queryByRole("button", { name: "Library" })).not.toBeInTheDocument();
    expect(props.onStrictUi).toHaveBeenCalledOnce();
    expect(props.onDiff).toHaveBeenCalledOnce();
    expect(props.onSave).toHaveBeenCalledOnce();
  });
});
