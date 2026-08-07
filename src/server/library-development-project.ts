import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

import type { ViteDevServer } from "vite";

import { libraryDevelopmentOperationSchema } from "../shared/contracts";
import type {
  DesignSpaceLibraryProjectConfig,
  LibraryDevelopmentProjectStatus,
  LibraryDevelopmentWorktree,
} from "../shared/source-workspace";
import { DesignSpaceError } from "./errors";
import type { OperationExecutor } from "./local-operation-service";
import type { RegisteredTarget } from "./target-registration";

const execFileAsync = promisify(execFile);
const stateDirectoryName = `design-space-${typeof process.getuid === "function" ? process.getuid() : "user"}`;

interface LibraryDevelopmentSelection {
  mode: "running" | "stopped";
  worktreeId?: string;
}

interface LibraryProjectPaths {
  checkoutPath: string;
  packageRoot: string;
}

interface LibraryDevelopmentProjectOptions {
  projectsRoot?: string;
  restartDelayMs?: number;
}

export class LibraryDevelopmentProjectService implements OperationExecutor {
  readonly #target: RegisteredTarget;
  readonly #projectsRoot?: string;
  readonly #restartDelayMs: number;
  #server?: ViteDevServer;

  constructor(target: RegisteredTarget, options: LibraryDevelopmentProjectOptions = {}) {
    this.#target = target;
    this.#projectsRoot = options.projectsRoot;
    this.#restartDelayMs = options.restartDelayMs ?? 80;
  }

  attachServer(server: ViteDevServer): void {
    this.#server = server;
  }

  async execute(input: unknown): Promise<LibraryDevelopmentProjectStatus> {
    const operation = libraryDevelopmentOperationSchema.safeParse(input);
    if (!operation.success) throw new DesignSpaceError("INVALID_REQUEST", "The library operation is invalid");
    const config = this.#target.libraryProject;
    if (!config) throw new DesignSpaceError("ACCESS_DENIED", "Library development is not configured");
    const projectsRoot = this.#projectsRoot ?? await resolveSharedProjectsRoot(this.#target.root);

    switch (operation.data.type) {
      case "get-library-development":
        return libraryDevelopmentStatus(this.#target, config, projectsRoot);
      case "clone-library-development":
        await cloneLibraryProject(config, projectsRoot);
        return libraryDevelopmentStatus(this.#target, config, projectsRoot);
      case "clone-library-development-worktree":
        await cloneLibraryWorktree(config, projectsRoot, operation.data.branch);
        return libraryDevelopmentStatus(this.#target, config, projectsRoot);
      case "start-library-development": {
        const worktreeId = operation.data.worktreeId;
        const status = await libraryDevelopmentStatus(this.#target, config, projectsRoot);
        const worktree = status.worktrees.find((candidate) => candidate.id === worktreeId);
        if (!worktree?.packageReady) {
          throw new DesignSpaceError("NOT_FOUND", "The selected library worktree is unavailable");
        }
        await writeSelection(this.#target.root, { mode: "running", worktreeId: worktree.id });
        this.#scheduleRestart();
        return {
          ...status,
          state: "running",
          activeWorktreeId: worktree.id,
          worktrees: status.worktrees.map((candidate) => ({ ...candidate, active: candidate.id === worktree.id })),
        };
      }
      case "stop-library-development": {
        await writeSelection(this.#target.root, { mode: "stopped" });
        this.#scheduleRestart();
        const status = await libraryDevelopmentStatus(this.#target, config, projectsRoot);
        return {
          ...status,
          state: "stopped",
          activeWorktreeId: undefined,
          worktrees: status.worktrees.map((candidate) => ({ ...candidate, active: false })),
        };
      }
    }
  }

  #scheduleRestart(): void {
    const server = this.#server;
    if (!server) throw new DesignSpaceError("VALIDATION_ERROR", "The Design Space dev server is unavailable");
    setTimeout(() => {
      void server.restart().then(() => {
        // The selected worktree is part of the generated target module. Once
        // the server has re-indexed it, tell the browser to load that module
        // again instead of leaving the old catalog mounted in memory.
        server.ws.send({ type: "full-reload" });
      }).catch(() => undefined);
    }, this.#restartDelayMs);
  }
}

export async function resolveConfiguredLibraryDevelopmentRoot(
  targetRoot: string,
  config: {
    project?: DesignSpaceLibraryProjectConfig;
    development?: { root: string };
  } | undefined,
): Promise<string | undefined> {
  if (!config?.project) {
    return config?.development ? resolve(targetRoot, config.development.root) : undefined;
  }
  const fallback = config.development ? resolve(targetRoot, config.development.root) : undefined;
  const selection = await readSelection(targetRoot);
  if (selection?.mode === "stopped") return undefined;
  if (!selection?.worktreeId) return fallback;

  const projectsRoot = await resolveSharedProjectsRoot(targetRoot);
  const paths = projectPaths(config.project, projectsRoot);
  const worktrees = await listLibraryWorktrees(paths.checkoutPath, config.project.packageRoot);
  const selected = worktrees.find((worktree) => worktree.id === selection.worktreeId && worktree.packageReady);
  return selected ? resolve(selected.path, config.project.packageRoot) : fallback;
}

export async function libraryDevelopmentStatus(
  target: Pick<RegisteredTarget, "root" | "sourceLibrary">,
  config: DesignSpaceLibraryProjectConfig,
  projectsRoot: string,
): Promise<LibraryDevelopmentProjectStatus> {
  const paths = projectPaths(config, projectsRoot);
  if (!await pathExists(paths.checkoutPath)) {
    return {
      configured: true,
      repository: config.repository,
      checkoutPath: paths.checkoutPath,
      cloned: false,
      state: "stopped",
      branches: [],
      worktrees: [],
    };
  }

  const activePackageRoot = target.sourceLibrary?.development?.root
    ? await realpath(target.sourceLibrary.development.root).catch(() => undefined)
    : undefined;
  const listed = await listLibraryWorktrees(paths.checkoutPath, config.packageRoot);
  const branches = await listLibraryBranches(paths.checkoutPath);
  const worktrees = await Promise.all(listed.map(async (worktree) => {
    const packagePath = await realpath(resolve(worktree.path, config.packageRoot)).catch(() => undefined);
    return { ...worktree, active: Boolean(packagePath && packagePath === activePackageRoot) };
  }));
  worktrees.sort((left, right) => {
    if (left.path === paths.checkoutPath) return -1;
    if (right.path === paths.checkoutPath) return 1;
    return left.branch.localeCompare(right.branch, "en");
  });
  const activeWorktree = worktrees.find((worktree) => worktree.active);
  return {
    configured: true,
    repository: config.repository,
    checkoutPath: paths.checkoutPath,
    cloned: true,
    state: activeWorktree ? "running" : "stopped",
    activeWorktreeId: activeWorktree?.id,
    branches,
    worktrees,
  };
}

export function parseGitBranchList(source: string): string[] {
  return [...new Set(source.split("\n").map((branch) => branch.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "en"));
}

export function parseGitWorktreeList(source: string, packageRoot: string): Promise<LibraryDevelopmentWorktree[]> {
  const records = source.trim().split(/\n\n+/).filter(Boolean);
  return Promise.all(records.map(async (record) => {
    const fields = new Map(record.split("\n").map((line) => {
      const separator = line.indexOf(" ");
      return separator === -1 ? [line, ""] : [line.slice(0, separator), line.slice(separator + 1)];
    }));
    const path = fields.get("worktree") ?? "";
    const head = fields.get("HEAD") ?? "";
    const branchRef = fields.get("branch");
    const branch = branchRef?.replace(/^refs\/heads\//, "")
      ?? (fields.has("detached") ? `Detached · ${head.slice(0, 8)}` : "Unknown branch");
    return {
      id: worktreeId(path),
      branch,
      path,
      head,
      packageReady: await libraryPackageReady(path, packageRoot),
      active: false,
    };
  }));
}

async function listLibraryWorktrees(
  checkoutPath: string,
  packageRoot: string,
): Promise<LibraryDevelopmentWorktree[]> {
  try {
    const { stdout } = await execFileAsync("git", ["-C", checkoutPath, "worktree", "list", "--porcelain"], {
      encoding: "utf8",
      maxBuffer: 2_000_000,
    });
    return parseGitWorktreeList(stdout, packageRoot);
  } catch {
    throw new DesignSpaceError("VALIDATION_ERROR", "The configured library checkout is not a valid Git project");
  }
}

async function listLibraryBranches(checkoutPath: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", checkoutPath, "for-each-ref", "--format=%(refname:short)", "refs/heads"],
      { encoding: "utf8", maxBuffer: 2_000_000 },
    );
    return parseGitBranchList(stdout);
  } catch {
    throw new DesignSpaceError("VALIDATION_ERROR", "The configured library branches could not be read");
  }
}

async function cloneLibraryProject(config: DesignSpaceLibraryProjectConfig, projectsRoot: string): Promise<void> {
  const { checkoutPath } = projectPaths(config, projectsRoot);
  if (await pathExists(checkoutPath)) return;
  await mkdir(projectsRoot, { recursive: true, mode: 0o700 });
  try {
    await execFileAsync("git", ["clone", "--origin", "origin", "--", config.repository, checkoutPath], {
      encoding: "utf8",
      maxBuffer: 10_000_000,
    });
  } catch {
    throw new DesignSpaceError("VALIDATION_ERROR", "The component library could not be cloned");
  }
}

async function cloneLibraryWorktree(
  config: DesignSpaceLibraryProjectConfig,
  projectsRoot: string,
  branch: string,
): Promise<void> {
  const { checkoutPath } = projectPaths(config, projectsRoot);
  if (!await pathExists(checkoutPath)) {
    throw new DesignSpaceError("NOT_FOUND", "Clone the component library before creating a worktree");
  }
  const branches = await listLibraryBranches(checkoutPath);
  if (!branches.includes(branch)) {
    throw new DesignSpaceError("NOT_FOUND", "The selected component-library branch does not exist");
  }
  const worktrees = await listLibraryWorktrees(checkoutPath, config.packageRoot);
  if (worktrees.some((worktree) => worktree.branch === branch)) return;

  const worktreesRoot = resolve(projectsRoot, ".worktrees", config.checkoutName);
  const branchSlug = branch.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "branch";
  const suffix = createHash("sha256").update(branch).digest("hex").slice(0, 8);
  const destination = resolve(worktreesRoot, `${branchSlug}-${suffix}`);
  if (await pathExists(destination)) {
    throw new DesignSpaceError("VALIDATION_ERROR", "The worktree destination already exists");
  }
  await mkdir(worktreesRoot, { recursive: true, mode: 0o700 });
  try {
    await execFileAsync("git", ["-C", checkoutPath, "worktree", "add", destination, branch], {
      encoding: "utf8",
      maxBuffer: 10_000_000,
    });
  } catch {
    throw new DesignSpaceError("VALIDATION_ERROR", "The component-library worktree could not be created");
  }
}

async function resolveSharedProjectsRoot(targetRoot: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", targetRoot, "rev-parse", "--path-format=absolute", "--git-common-dir"],
      { encoding: "utf8", maxBuffer: 100_000 },
    );
    return dirname(dirname(stdout.trim()));
  } catch {
    throw new DesignSpaceError("VALIDATION_ERROR", "The project directory could not be resolved");
  }
}

function projectPaths(config: DesignSpaceLibraryProjectConfig, projectsRoot: string): LibraryProjectPaths {
  const checkoutPath = resolve(projectsRoot, config.checkoutName);
  if (dirname(checkoutPath) !== resolve(projectsRoot)) {
    throw new DesignSpaceError("ACCESS_DENIED", "The library checkout is outside the projects directory");
  }
  return { checkoutPath, packageRoot: resolve(checkoutPath, config.packageRoot) };
}

async function libraryPackageReady(worktreePath: string, packageRoot: string): Promise<boolean> {
  const root = resolve(worktreePath, packageRoot);
  return pathExists(join(root, "package.json"));
}

async function pathExists(path: string): Promise<boolean> {
  return access(path).then(() => true, () => false);
}

function worktreeId(path: string): string {
  return `worktree-${createHash("sha256").update(path).digest("hex").slice(0, 20)}`;
}

function selectionPath(targetRoot: string): string {
  const id = createHash("sha256").update(targetRoot).digest("hex").slice(0, 24);
  return join(tmpdir(), stateDirectoryName, `library-${id}.json`);
}

async function readSelection(targetRoot: string): Promise<LibraryDevelopmentSelection | undefined> {
  try {
    const value = JSON.parse(await readFile(selectionPath(targetRoot), "utf8")) as Partial<LibraryDevelopmentSelection>;
    if (value.mode !== "running" && value.mode !== "stopped") return undefined;
    if (value.worktreeId !== undefined && !/^[a-z][a-z0-9-]{1,95}$/i.test(value.worktreeId)) return undefined;
    return { mode: value.mode, ...(value.worktreeId ? { worktreeId: value.worktreeId } : {}) };
  } catch {
    return undefined;
  }
}

async function writeSelection(targetRoot: string, selection: LibraryDevelopmentSelection): Promise<void> {
  const path = selectionPath(targetRoot);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, `${JSON.stringify(selection)}\n`, { encoding: "utf8", mode: 0o600 });
}
