import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { LibraryDevelopmentProjectStatus } from "../../shared/source-workspace";
import { LibraryFilesHeader } from "./LibraryFilesHeader";

const runLocalOperation = vi.hoisted(() => vi.fn());

vi.mock("../api", () => ({ runLocalOperation }));

const status: LibraryDevelopmentProjectStatus = {
  configured: true,
  repository: "https://github.com/DotNaos/ui.git",
  checkoutPath: "/Users/oli/projects/ui",
  cloned: true,
  state: "running",
  activeWorktreeId: "worktree-main",
  branches: ["feature/available", "feature/not-cloned", "main"],
  worktrees: [
    {
      id: "worktree-main",
      branch: "main",
      path: "/Users/oli/projects/ui",
      head: "a".repeat(40),
      packageReady: true,
      active: true,
    },
    {
      id: "worktree-available",
      branch: "feature/available",
      path: "/Users/oli/projects/.worktrees/ui/feature-available",
      head: "b".repeat(40),
      packageReady: true,
      active: false,
    },
  ],
};

beforeEach(() => runLocalOperation.mockReset());
afterEach(cleanup);

it("shows the active project path and switches to an existing worktree", async () => {
  runLocalOperation.mockResolvedValueOnce(status).mockResolvedValueOnce({
    ...status,
    activeWorktreeId: "worktree-available",
    worktrees: status.worktrees.map((worktree) => ({
      ...worktree,
      active: worktree.id === "worktree-available",
    })),
  });

  render(<LibraryFilesHeader fileCount={12} />);

  expect(await screen.findByText("/Users/oli/projects/ui")).toBeInTheDocument();
  expect(screen.getByText("12")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Library branch and worktree" }));
  await userEvent.click(screen.getByRole("button", { name: "feature/available" }));

  await waitFor(() => expect(runLocalOperation).toHaveBeenLastCalledWith({
    type: "start-library-development",
    worktreeId: "worktree-available",
  }));
});

it("offers to clone branches that do not have a worktree yet", async () => {
  runLocalOperation.mockResolvedValueOnce(status).mockResolvedValueOnce({
    ...status,
    worktrees: [
      ...status.worktrees,
      {
        id: "worktree-not-cloned",
        branch: "feature/not-cloned",
        path: "/Users/oli/projects/.worktrees/ui/feature-not-cloned",
        head: "c".repeat(40),
        packageReady: true,
        active: false,
      },
    ],
  });

  render(<LibraryFilesHeader fileCount={0} />);

  await userEvent.click(await screen.findByRole("button", { name: "Library branch and worktree" }));
  await userEvent.click(screen.getByRole("button", { name: "Clone feature/not-cloned worktree" }));

  await waitFor(() => expect(runLocalOperation).toHaveBeenLastCalledWith({
    type: "clone-library-development-worktree",
    branch: "feature/not-cloned",
  }));
});
