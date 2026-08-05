import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import type { RuntimeSourceWorkspaceEntry } from "../../shared/source-workspace";
import { SourceComponentReviewCheckpoint } from "./SourceComponentReviewCheckpoint";

const entry: RuntimeSourceWorkspaceEntry = {
  id: "entry.workspace-shell",
  label: "Workspace shell",
  area: "components",
  device: "desktop",
  fileId: "file.workspace-shell",
  relativePath: "src/WorkspaceShell.tsx",
  exportName: "WorkspaceShell",
  props: [{ name: "compact", type: "boolean", required: false, kind: "boolean" }],
  slots: [{ name: "content", type: "ComponentSlot<Main>", required: true, multiple: false, accepts: ["Main"], min: 1, max: 1 }],
  findings: [],
  source: { start: 0, end: 10 },
  design: { fileId: "design.workspace-shell", relativePath: "src/WorkspaceShell.design.tsx", load: vi.fn() },
  component: () => null,
};

it("keeps the one-component signature disabled with a visible reason when approvals are not configured", () => {
  render(<SourceComponentReviewCheckpoint
    approved={0}
    dirty={false}
    entry={entry}
    evidence={{ status: "not-configured", reason: "Configure the project approval policy.", components: {} }}
    index={0}
    signing={false}
    total={3}
    onRequestChanges={vi.fn()}
    onSign={vi.fn()}
  />);

  expect(screen.getByRole("button", { name: "Sign Workspace shell with Touch ID" })).toBeDisabled();
  expect(screen.getByText("Configure the project approval policy.")).toBeInTheDocument();
  expect(screen.getByTestId("source-component-review-checkpoint")).toHaveClass("rounded-full", "bg-white/[0.035]");
  expect(screen.getByText("1/3")).toHaveClass("rounded-full");
  expect(screen.queryByText("Component · WorkspaceShell")).not.toBeInTheDocument();
  expect(screen.queryByText("Properties")).not.toBeInTheDocument();
  expect(screen.queryByText("States")).not.toBeInTheDocument();
  expect(screen.queryByText("Slots")).not.toBeInTheDocument();
});

it("shows a completed checkpoint and opens the next component", async () => {
  const onNext = vi.fn();
  render(<SourceComponentReviewCheckpoint
    approved={1}
    dirty={false}
    entry={entry}
    evidence={{
      status: "verified",
      components: {
        [entry.id]: { scopeId: "workspace-shell", label: entry.label, state: "approved", attestation: "signed" },
      },
    }}
    index={0}
    signing={false}
    total={3}
    onNext={onNext}
    onRequestChanges={vi.fn()}
    onSign={vi.fn()}
  />);

  await userEvent.click(screen.getByRole("button", { name: "Open next component" }));
  expect(onNext).toHaveBeenCalledOnce();
  expect(screen.getByText("Signed for the current component revision")).toBeInTheDocument();
});
