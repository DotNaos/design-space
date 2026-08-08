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
  expect(await screen.findByRole("dialog", { name: "Switch library branch" })).toHaveTextContent(
    "The existing branch worktree will be reused",
  );
  await userEvent.click(screen.getByRole("button", { name: "Switch and reload" }));

  await waitFor(() => expect(runLocalOperation).toHaveBeenLastCalledWith({
    type: "activate-library-development-branch",
    branch: "feature/available",
  }));
});

it("confirms creation before activating a branch without a worktree", async () => {
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
  await userEvent.click(screen.getByRole("button", { name: "feature/not-cloned" }));
  expect(await screen.findByRole("dialog", { name: "Switch library branch" })).toHaveTextContent(
    "A dedicated worktree will be created",
  );
  await userEvent.click(screen.getByRole("button", { name: "Switch and reload" }));

  await waitFor(() => expect(runLocalOperation).toHaveBeenLastCalledWith({
    type: "activate-library-development-branch",
    branch: "feature/not-cloned",
  }));
});

it("keeps activation failures visible in the confirmation dialog", async () => {
  runLocalOperation.mockResolvedValueOnce(status).mockRejectedValueOnce(new Error("Dependency installation failed."));

  render(<LibraryFilesHeader fileCount={0} />);

  await userEvent.click(await screen.findByRole("button", { name: "Library branch and worktree" }));
  await userEvent.click(screen.getByRole("button", { name: "feature/not-cloned" }));
  await userEvent.click(await screen.findByRole("button", { name: "Switch and reload" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Dependency installation failed.");
  expect(screen.getByRole("dialog", { name: "Switch library branch" })).toBeInTheDocument();
});

it("offers a toggle for gitignored files", async () => {
  const onChange = vi.fn();
  runLocalOperation.mockResolvedValueOnce(status);
  render(<LibraryFilesHeader fileCount={12} ignoredFileCount={4} onShowIgnoredFilesChange={onChange} />);

  const toggle = await screen.findByRole("button", { name: "Show gitignored files" });
  await userEvent.click(toggle);
  expect(onChange).toHaveBeenCalledWith(true);
});
