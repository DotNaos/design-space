import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { LibraryDevelopmentProjectStatus } from "../../shared/source-workspace";
import { LibraryDevelopmentSourceControl } from "./LibraryDevelopmentSourceControl";

const runLocalOperation = vi.hoisted(() => vi.fn());

vi.mock("../api", () => ({ runLocalOperation }));

const readyWorktree = {
  id: "worktree-ready",
  branch: "feature/designs",
  path: "/projects/.worktrees/ui-designs",
  head: "0123456789abcdef",
  packageReady: true,
  active: false,
};

beforeEach(() => {
  runLocalOperation.mockReset();
  localStorage.clear();
});

afterEach(cleanup);

it("clones the configured library when no checkout exists", async () => {
  const missing: LibraryDevelopmentProjectStatus = {
    configured: true,
    repository: "https://github.com/DotNaos/ui.git",
    checkoutPath: "/projects/ui",
    cloned: false,
    state: "stopped",
    worktrees: [],
  };
  runLocalOperation.mockResolvedValueOnce(missing).mockResolvedValueOnce({
    ...missing,
    cloned: true,
    worktrees: [readyWorktree],
  });

  render(<LibraryDevelopmentSourceControl onModeChange={vi.fn()} />);

  const clone = await screen.findByRole("button", { name: "Clone development source" });
  await userEvent.click(clone);

  await waitFor(() => expect(runLocalOperation).toHaveBeenLastCalledWith({
    type: "clone-library-development",
  }));
});

it("starts the selected worktree as the editable development source", async () => {
  const stopped: LibraryDevelopmentProjectStatus = {
    configured: true,
    repository: "https://github.com/DotNaos/ui.git",
    checkoutPath: "/projects/ui",
    cloned: true,
    state: "stopped",
    worktrees: [readyWorktree],
  };
  const onModeChange = vi.fn();
  runLocalOperation.mockResolvedValueOnce(stopped).mockResolvedValueOnce({
    ...stopped,
    state: "running",
    activeWorktreeId: readyWorktree.id,
    worktrees: [{ ...readyWorktree, active: true }],
  });

  render(<LibraryDevelopmentSourceControl onModeChange={onModeChange} />);

  expect(await screen.findByRole("button", { name: "Development library worktree" })).toHaveTextContent(readyWorktree.branch);
  expect(screen.queryByText(readyWorktree.path)).not.toBeInTheDocument();
  const start = await screen.findByRole("button", { name: "Start development source" });
  await userEvent.click(start);

  await waitFor(() => expect(runLocalOperation).toHaveBeenLastCalledWith({
    type: "start-library-development",
    worktreeId: readyWorktree.id,
  }));
  expect(onModeChange).toHaveBeenCalledWith("development");
  expect(localStorage.getItem("design-space.library-source")).toBe("development");
});

it("defaults to the main checkout directly below the projects directory", async () => {
  const featureWorktree = {
    ...readyWorktree,
    id: "worktree-feature",
  };
  const mainWorktree = {
    ...readyWorktree,
    id: "worktree-main",
    branch: "main",
    path: "/projects/ui",
  };
  const stopped: LibraryDevelopmentProjectStatus = {
    configured: true,
    repository: "https://github.com/DotNaos/ui.git",
    checkoutPath: "/projects/ui",
    cloned: true,
    state: "stopped",
    worktrees: [featureWorktree, mainWorktree],
  };
  runLocalOperation.mockResolvedValueOnce(stopped).mockResolvedValueOnce({
    ...stopped,
    state: "running",
    activeWorktreeId: mainWorktree.id,
    worktrees: [featureWorktree, { ...mainWorktree, active: true }],
  });

  render(<LibraryDevelopmentSourceControl onModeChange={vi.fn()} />);

  await userEvent.click(await screen.findByRole("button", { name: "Start development source" }));

  await waitFor(() => expect(runLocalOperation).toHaveBeenLastCalledWith({
    type: "start-library-development",
    worktreeId: mainWorktree.id,
  }));
});

it("stops development and returns to the installed release", async () => {
  const running: LibraryDevelopmentProjectStatus = {
    configured: true,
    repository: "https://github.com/DotNaos/ui.git",
    checkoutPath: "/projects/ui",
    cloned: true,
    state: "running",
    activeWorktreeId: readyWorktree.id,
    worktrees: [{ ...readyWorktree, active: true }],
  };
  const onModeChange = vi.fn();
  runLocalOperation.mockResolvedValueOnce(running).mockResolvedValueOnce({
    ...running,
    state: "stopped",
    activeWorktreeId: undefined,
    worktrees: [readyWorktree],
  });

  render(<LibraryDevelopmentSourceControl onModeChange={onModeChange} />);

  const stop = await screen.findByRole("button", { name: "Stop development source" });
  await userEvent.click(stop);

  await waitFor(() => expect(runLocalOperation).toHaveBeenLastCalledWith({
    type: "stop-library-development",
  }));
  expect(onModeChange).toHaveBeenCalledWith("release");
  expect(localStorage.getItem("design-space.library-source")).toBe("release");
});
