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

it("shows no active branch while the installed source is still selected", async () => {
  const stopped: LibraryDevelopmentProjectStatus = {
    configured: true,
    repository: "https://github.com/DotNaos/ui.git",
    checkoutPath: "/projects/ui",
    cloned: true,
    state: "stopped",
    branches: [readyWorktree.branch],
    worktrees: [readyWorktree],
  };
  runLocalOperation.mockResolvedValueOnce(stopped);

  render(<LibraryDevelopmentSourceControl onModeChange={vi.fn()} />);

  expect(await screen.findByRole("button", { name: "Development library worktree" })).toHaveTextContent("Choose branch");
  expect(screen.queryByText(readyWorktree.path)).not.toBeInTheDocument();
  expect(screen.queryByText("Start")).not.toBeInTheDocument();
  expect(screen.queryByText("Stop")).not.toBeInTheDocument();
});

it("confirms and reloads before activating an existing branch worktree", async () => {
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
    branches: [featureWorktree.branch, mainWorktree.branch],
    worktrees: [featureWorktree, mainWorktree],
  };
  runLocalOperation.mockResolvedValueOnce(stopped).mockResolvedValueOnce({
    ...stopped,
    state: "running",
    activeWorktreeId: mainWorktree.id,
    worktrees: [featureWorktree, { ...mainWorktree, active: true }],
  });

  render(<LibraryDevelopmentSourceControl onModeChange={vi.fn()} />);

  const worktrees = await screen.findByRole("button", { name: "Development library worktree" });
  await userEvent.click(worktrees);
  const search = screen.getByRole("textbox", { name: "Search branches" });
  await userEvent.type(search, "main");
  expect(screen.getByRole("option", { name: "main" })).toBeVisible();
  expect(screen.queryByRole("option", { name: "feature/designs" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("option", { name: "main" }));

  expect(await screen.findByRole("dialog", { name: "Switch library branch" })).toHaveTextContent(
    "The existing branch worktree will be reused",
  );
  expect(runLocalOperation).toHaveBeenCalledTimes(1);
  await userEvent.click(screen.getByRole("button", { name: "Switch and reload" }));

  await waitFor(() => expect(runLocalOperation).toHaveBeenLastCalledWith({
    type: "activate-library-development-branch",
    branch: "main",
  }));
});

it("creates a dedicated worktree when the selected branch is not materialized", async () => {
  const mainWorktree = {
    ...readyWorktree,
    id: "worktree-main",
    branch: "main",
    path: "/projects/ui",
    active: true,
  };
  const featureBranch = "feature/catalog";
  const running: LibraryDevelopmentProjectStatus = {
    configured: true,
    repository: "https://github.com/DotNaos/ui.git",
    checkoutPath: "/projects/ui",
    cloned: true,
    state: "running",
    activeWorktreeId: mainWorktree.id,
    branches: [mainWorktree.branch, featureBranch],
    worktrees: [mainWorktree],
  };
  runLocalOperation.mockResolvedValueOnce(running).mockResolvedValueOnce({
    ...running,
    activeWorktreeId: "worktree-feature",
    worktrees: [
      { ...mainWorktree, active: false },
      { ...readyWorktree, id: "worktree-feature", branch: featureBranch, active: true },
    ],
  });

  render(<LibraryDevelopmentSourceControl onModeChange={vi.fn()} />);

  const worktrees = await screen.findByRole("button", { name: "Development library worktree" });
  expect(worktrees).not.toBeDisabled();
  await userEvent.click(worktrees);
  await userEvent.click(screen.getByRole("option", { name: /feature\/catalog/ }));
  expect(await screen.findByRole("dialog", { name: "Switch library branch" })).toHaveTextContent(
    "A dedicated worktree will be created",
  );
  await userEvent.click(screen.getByRole("button", { name: "Switch and reload" }));

  await waitFor(() => expect(runLocalOperation).toHaveBeenLastCalledWith({
    type: "activate-library-development-branch",
    branch: featureBranch,
  }));
});

it("keeps the active branch when the reload is cancelled", async () => {
  const running: LibraryDevelopmentProjectStatus = {
    configured: true,
    repository: "https://github.com/DotNaos/ui.git",
    checkoutPath: "/projects/ui",
    cloned: true,
    state: "running",
    activeWorktreeId: readyWorktree.id,
    worktrees: [{ ...readyWorktree, active: true }],
  };
  const alternative = { ...readyWorktree, id: "worktree-other", branch: "feature/other" };
  runLocalOperation.mockResolvedValueOnce({ ...running, branches: [readyWorktree.branch, alternative.branch], worktrees: [
    { ...readyWorktree, active: true },
    alternative,
  ] });

  render(<LibraryDevelopmentSourceControl onModeChange={vi.fn()} />);

  const branches = await screen.findByRole("button", { name: "Development library worktree" });
  await userEvent.click(branches);
  await userEvent.click(screen.getByRole("option", { name: alternative.branch }));
  await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));

  expect(screen.queryByRole("dialog", { name: "Switch library branch" })).not.toBeInTheDocument();
  expect(runLocalOperation).toHaveBeenCalledTimes(1);
  expect(branches).toHaveTextContent(readyWorktree.branch);
});
