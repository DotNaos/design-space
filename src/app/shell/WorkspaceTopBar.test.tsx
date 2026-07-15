import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkspaceTopBar } from "./WorkspaceTopBar";

afterEach(cleanup);

function renderTopBar(overrides: Partial<Parameters<typeof WorkspaceTopBar>[0]> = {}) {
  const props: Parameters<typeof WorkspaceTopBar>[0] = {
    targetLabel: "Demo target",
    documentLabel: "Quarterly planning",
    mode: "app",
    connected: true,
    checking: false,
    canUndo: true,
    canRedo: true,
    canReset: true,
    canStrictUi: true,
    canDiff: true,
    canSave: true,
    saving: false,
    onModeChange: vi.fn(),
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
    expect(screen.getByText("Quarterly planning")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Local preview connected" })).toBeInTheDocument();
    expect(screen.queryByText("Design Space")).not.toBeInTheDocument();
  });

  it("keeps mode, strict UI, diff, and save actions available", async () => {
    const props = renderTopBar();

    await userEvent.click(screen.getByRole("button", { name: "Library" }));
    await userEvent.click(screen.getByRole("button", { name: "Strict UI not checked" }));
    await userEvent.click(screen.getByRole("button", { name: "Prepare exact diff" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(props.onModeChange).toHaveBeenCalledWith("library");
    expect(props.onStrictUi).toHaveBeenCalledOnce();
    expect(props.onDiff).toHaveBeenCalledOnce();
    expect(props.onSave).toHaveBeenCalledOnce();
  });
});
