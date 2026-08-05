import { lstat, readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

const DESIGN_SPACE_CONFIG_FILE = ".designspace.ts";

const SOURCE_LAYOUT_CANDIDATES = [
  "src/app/App.tsx",
  "src/App.tsx",
  "src/app/layout.tsx",
  "app/layout.tsx",
] as const;

export interface ProjectInitializationResult {
  configCreated: boolean;
  configPath: string;
  packageScriptUpdated: boolean;
  projectId: string;
}

export async function initializeDesignSpaceProject(projectRoot: string): Promise<ProjectInitializationResult> {
  const root = resolve(projectRoot);
  const packagePath = resolve(root, "package.json");
  const packageJson = await readProjectPackage(packagePath);
  const projectId = projectIdFromPackage(packageJson.name, root);
  const projectLabel = projectLabelFromId(projectId);
  const configPath = resolve(root, DESIGN_SPACE_CONFIG_FILE);
  const configCreated = !await pathExists(configPath);

  if (configCreated) {
    const sourceLayout = await firstExistingPath(root, SOURCE_LAYOUT_CANDIDATES);
    await writeFile(configPath, renderConfig({ projectId, projectLabel, sourceLayout }), { flag: "wx" });
  }

  const scripts = isRecord(packageJson.scripts) ? packageJson.scripts : {};
  const packageScriptUpdated = scripts["design-space"] !== "design-space";
  if (packageScriptUpdated) {
    packageJson.scripts = { ...scripts, "design-space": "design-space" };
    await writeJsonAtomically(packagePath, packageJson);
  }

  return { configCreated, configPath, packageScriptUpdated, projectId };
}

async function readProjectPackage(packagePath: string): Promise<Record<string, unknown>> {
  const source = await readFile(packagePath, "utf8").catch((error: unknown) => {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new Error("The current directory has no package.json. Run init from the frontend project root.");
    }
    throw error;
  });
  const parsed: unknown = JSON.parse(source);
  if (!isRecord(parsed)) throw new Error("The current package.json must contain a JSON object.");
  return parsed;
}

function projectIdFromPackage(value: unknown, projectRoot: string): string {
  const packageName = typeof value === "string" ? value.split("/").at(-1) : basename(projectRoot);
  return (packageName ?? "app")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-") || "app";
}

function projectLabelFromId(projectId: string): string {
  return projectId
    .split("-")
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

async function firstExistingPath(root: string, candidates: readonly string[]): Promise<string | undefined> {
  for (const candidate of candidates) {
    if (await pathExists(resolve(root, candidate))) return candidate;
  }
  return undefined;
}

function renderConfig(options: { projectId: string; projectLabel: string; sourceLayout?: string }): string {
  const source = options.sourceLayout
    ? `\n  source: {\n    layout: ${JSON.stringify(options.sourceLayout)},\n  },`
    : "";
  return `import { defineDesignSpace } from "@dotnaos/design-space/source-workspace";\n\nexport default defineDesignSpace({\n  project: {\n    id: ${JSON.stringify(options.projectId)},\n    label: ${JSON.stringify(options.projectLabel)},\n  },\n  devices: {\n    mode: "responsive",\n  },${source}\n});\n`;
}

async function writeJsonAtomically(path: string, value: Record<string, unknown>): Promise<void> {
  const temporaryPath = resolve(dirname(path), `.${basename(path)}.design-space-${process.pid}.tmp`);
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
  await rename(temporaryPath, path);
}

async function pathExists(path: string): Promise<boolean> {
  return Boolean(await lstat(path).catch(() => undefined));
}

function isNodeError(value: unknown): value is NodeJS.ErrnoException {
  return value instanceof Error && "code" in value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
