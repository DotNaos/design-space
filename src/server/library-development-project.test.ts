import { execFile } from "node:child_process";
import { mkdtemp, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import {
  ensureLibraryWorktree,
  libraryWorktreePath,
  parseGitBranchList,
  parseGitWorktreeList,
} from "./library-development-project";

const temporaryDirectories: string[] = [];
const execFileAsync = promisify(execFile);

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })));
});

describe("library development worktrees", () => {
  it("lists local branches once in a stable order", () => {
    expect(parseGitBranchList("feature/zeta\nmain\nfeature/alpha\nmain\n")).toEqual([
      "feature/alpha",
      "feature/zeta",
      "main",
    ]);
  });

  it("lists every checkout that contains the configured UI package", async () => {
    const root = await mkdtemp(join(tmpdir(), "design-space-library-"));
    temporaryDirectories.push(root);
    const ready = join(root, "ready");
    const incomplete = join(root, "incomplete");
    await mkdir(join(ready, "packages", "react-ui"), { recursive: true });
    await mkdir(join(incomplete, "packages", "react-ui"), { recursive: true });
    await writeFile(join(ready, "packages", "react-ui", "package.json"), "{}");
    await writeFile(join(incomplete, "packages", "react-ui", "README.md"), "Not a package");

    const result = await parseGitWorktreeList([
      `worktree ${ready}`,
      `HEAD ${"a".repeat(40)}`,
      "branch refs/heads/main",
      "",
      `worktree ${incomplete}`,
      `HEAD ${"b".repeat(40)}`,
      "detached",
      "",
    ].join("\n"), "packages/react-ui");

    expect(result).toEqual([
      expect.objectContaining({
        active: false,
        branch: "main",
        head: "a".repeat(40),
        packageReady: true,
        path: ready,
      }),
      expect.objectContaining({
        active: false,
        branch: `Detached · ${"b".repeat(8)}`,
        head: "b".repeat(40),
        packageReady: false,
        path: incomplete,
      }),
    ]);
    expect(result[0]?.id).toMatch(/^worktree-[a-f0-9]{20}$/);
  });

  it("uses the Project worktree convention without flattening branch paths", () => {
    expect(libraryWorktreePath("/Users/oli/projects/.worktrees/ui", "feature/component-groups"))
      .toBe("/Users/oli/projects/.worktrees/ui/feature/component-groups");
  });

  it("rejects branch paths that escape the project worktree directory", () => {
    expect(() => libraryWorktreePath("/Users/oli/projects/.worktrees/ui", "../other"))
      .toThrow("cannot escape");
  });

  it("materializes each branch in the standard project worktree path", async () => {
    const projectsRoot = await mkdtemp(join(tmpdir(), "design-space-projects-"));
    temporaryDirectories.push(projectsRoot);
    const checkout = join(projectsRoot, "ui");
    await mkdir(join(checkout, "packages", "react-ui"), { recursive: true });
    await mkdir(join(checkout, "node_modules"), { recursive: true });
    await writeFile(join(checkout, "packages", "react-ui", "package.json"), "{}\n");
    await writeFile(join(checkout, "node_modules", ".keep"), "\n");
    await execFileAsync("git", ["init", "-b", "main", checkout]);
    await execFileAsync("git", ["-C", checkout, "config", "user.email", "test@design-space.local"]);
    await execFileAsync("git", ["-C", checkout, "config", "user.name", "Design Space Test"]);
    await execFileAsync("git", ["-C", checkout, "add", "-f", "."]);
    await execFileAsync("git", ["-C", checkout, "commit", "-m", "fixture"]);
    await execFileAsync("git", ["-C", checkout, "branch", "feature/nested"]);

    await ensureLibraryWorktree({
      repository: "https://example.invalid/ui.git",
      checkoutName: "ui",
      packageRoot: "packages/react-ui",
    }, projectsRoot, "feature/nested");

    const expected = await realpath(join(projectsRoot, ".worktrees", "ui", "feature", "nested"));
    const { stdout } = await execFileAsync("git", ["-C", checkout, "worktree", "list", "--porcelain"]);
    expect(stdout).toContain(`worktree ${expected}`);
    expect(stdout).toContain("branch refs/heads/feature/nested");
  });
});
