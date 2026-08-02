import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkspaceTopBar } from "./WorkspaceTopBar";

afterEach(cleanup);

function renderTopBar(overrides: Partial<Parameters<typeof WorkspaceTopBar>[0]> = {}) {
  const props: Parameters<typeof WorkspaceTopBar>[0] = {
    targetLabel: "Demo target",
    documentLabel: "Quarterly planning",
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
  it("shows only the project context without a connection label or product wordmark", () => {
    renderTopBar();

    expect(screen.getByText("Demo target")).toBeInTheDocument();
    expect(screen.queryByLabelText("Current document path")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText("Connected")).not.toBeInTheDocument();
    expect(screen.queryByText("Design Space")).not.toBeInTheDocument();
  });

  it("switches the current project between its app and library from the top bar", async () => {
    const onChange = vi.fn();
    renderTopBar({
      surfaceNavigation: {
        value: "app",
        libraryLabel: "@dotnaos/react-ui",
        onChange,
      },
    });

    await userEvent.click(screen.getByRole("button", { name: /Current workspace: Demo target, App/ }));
    await userEvent.click(screen.getByRole("menuitem", { name: /Library/ }));

    expect(onChange).toHaveBeenCalledWith("library");
    expect(screen.queryByRole("button", { name: /Workspace source/ })).not.toBeInTheDocument();
  });

  it("anchors the workspace switcher to the true center of the top bar", () => {
    renderTopBar();

    expect(screen.getByRole("button", { name: /Current workspace:/ }).parentElement)
      .toHaveClass("absolute", "left-1/2", "-translate-x-1/2");
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

  it("replaces direct save actions with one staged review trigger", async () => {
    const onReviewChanges = vi.fn();
    renderTopBar({ pendingChanges: 3, onReviewChanges });

    await userEvent.click(screen.getByRole("button", { name: "Review 3 pending changes" }));

    expect(screen.getByText("3 changes")).toBeVisible();
    expect(screen.getByText("Draft")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Prepare exact diff" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(onReviewChanges).toHaveBeenCalledOnce();
  });
});
