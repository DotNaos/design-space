import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, link, open, realpath, rm, stat } from "node:fs/promises";
import { basename, dirname, relative } from "node:path";

import type { GeneratedSourceDesign } from "../shared/contracts";
import { suggestedSourceDesignPath, type SourceDesignScope } from "../shared/source-design";
import type { SourceComponentProp, SourceWorkspaceEntry } from "../shared/source-workspace";
import { DesignSpaceError } from "./errors";
import { assertStillRegistered } from "./path-security";
import type { IndexedSourceWorkspace } from "./source-file-index";
import type { RegisteredTarget } from "./target-registration";
import { assertEditedTypeScriptCompiles } from "./typescript-project-compiler";

export class SourceDesignGeneration {
  constructor(private readonly target: RegisteredTarget) {}

  async generate(scope: SourceDesignScope, entryId: string): Promise<GeneratedSourceDesign> {
    const workspace = this.workspace(scope);
    const entry = workspace.manifest.entries.find((candidate) => candidate.id === entryId);
    if (!entry) throw new DesignSpaceError("NOT_FOUND", "The component is not registered in this source catalog");
    if (entry.design) throw new DesignSpaceError("STALE_SOURCE", "This component already has a design file");
    const sourcePath = workspace.entryFiles.get(entry.id);
    if (!sourcePath) throw new DesignSpaceError("INVALID_REGISTRATION", "The component source file is not registered");
    const relativePath = suggestedSourceDesignPath(entry, workspace.manifest.entries);
    const designPath = `${workspace.root}/${relativePath}`;
    if (dirname(designPath) !== dirname(sourcePath)) {
      throw new DesignSpaceError("ACCESS_DENIED", "Generated designs must stay beside their component source");
    }
    const helper = designHelper(workspace);
    if (!helper) {
      throw new DesignSpaceError("INVALID_REGISTRATION", "No local defineComponentDesign helper is registered for this source project");
    }
    const source = generatedDesignSource(entry, sourcePath, designPath, helper.absolutePath, scope);
    assertEditedTypeScriptCompiles(workspace.root, designPath, source);
    await commitGeneratedDesign(workspace.root, sourcePath, designPath, source);
    return { state: "source-design-generated", scope, entryId, relativePath };
  }

  private workspace(scope: SourceDesignScope): IndexedSourceWorkspace {
    const workspace = scope === "app"
      ? this.target.sourceWorkspace
      : this.target.sourceLibrary?.development;
    if (!workspace) {
      throw new DesignSpaceError("ACCESS_DENIED", scope === "app"
        ? "This project has no editable source workspace"
        : "The development library source is not attached");
    }
    return workspace;
  }
}

function designHelper(workspace: IndexedSourceWorkspace) {
  const candidates = workspace.files.filter((file) => /\/(?:component-design|define-design)\.tsx?$/.test(`/${file.relativePath}`));
  return candidates.sort((left, right) => helperPriority(left.relativePath) - helperPriority(right.relativePath))[0];
}

function helperPriority(path: string): number {
  if (path.endsWith("/component-design.ts")) return 0;
  if (path.endsWith("/define-design.ts")) return 1;
  return 2;
}

export function generatedDesignSource(
  entry: SourceWorkspaceEntry,
  sourcePath: string,
  designPath: string,
  helperPath: string,
  scope: SourceDesignScope = "app",
): string {
  const acceptsProps = entry.props.length > 0 || entry.slots.length > 0;
  const componentImport = entry.exportName === "default"
    ? `import ComponentUnderDesign from ${JSON.stringify(relativeImport(designPath, sourcePath))};`
    : `import { ${entry.exportName} as ComponentUnderDesign } from ${JSON.stringify(relativeImport(designPath, sourcePath))};`;
  const defaults = generatedDefaults(entry, scope);
  return [
    ...(acceptsProps ? ['import type { ComponentProps } from "react";'] : []),
    ...(defaults.usesTarget ? ['import target from "virtual:design-space-target";'] : []),
    "",
    `import { defineComponentDesign } from ${JSON.stringify(relativeImport(designPath, helperPath))};`,
    componentImport,
    "",
    "export default defineComponentDesign(ComponentUnderDesign, {",
    "  isStateful: false,",
    acceptsProps
      ? `  defaults: ${defaults.source} as unknown as ComponentProps<typeof ComponentUnderDesign>,`
      : "  defaults: {},",
    "  designs: { default: {} },",
    acceptsProps
      ? "  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,"
      : "  render: () => <ComponentUnderDesign />,",
    "});",
    "",
  ].join("\n");
}

function generatedDefaults(
  entry: SourceWorkspaceEntry,
  scope: SourceDesignScope,
): Readonly<{ source: string; usesTarget: boolean }> {
  let usesTarget = false;
  const values = entry.props.flatMap((property) => {
    const targetValue = targetDefaultValue(property, entry, scope);
    if (targetValue) {
      usesTarget = true;
      return [`    ${propertyKey(property.name)}: ${targetValue}`];
    }
    return property.required
      ? [`    ${propertyKey(property.name)}: ${defaultValue(property)}`]
      : [];
  });
  if (entry.slots.length) {
    const slots = entry.slots.filter((slot) => slot.required).map((slot) => (
      `      ${propertyKey(slot.name)}: undefined as never`
    ));
    values.push(slots.length ? `    slots: {\n${slots.join(",\n")},\n    }` : "    slots: {}");
  }
  return {
    source: values.length ? `{\n${values.join(",\n")},\n  }` : "{}",
    usesTarget,
  };
}

function targetDefaultValue(
  property: SourceComponentProp,
  entry: SourceWorkspaceEntry,
  scope: SourceDesignScope,
): string | undefined {
  const workspace = scope === "app"
    ? "target.sourceWorkspace"
    : "target.sourceLibrary?.development";
  if (/\b(?:Runtime)?SourceWorkspaceEntry\b/.test(property.type)) {
    return `${workspace}?.entries.find((entry) => entry.relativePath === ${JSON.stringify(entry.relativePath)} && entry.exportName === ${JSON.stringify(entry.exportName)})`;
  }
  if (/\bRuntimeSourceWorkspace\b/.test(property.type)) return workspace;
  if (/\bTargetModule\b/.test(property.type)) return "target";
  return undefined;
}

function defaultValue(property: SourceComponentProp): string {
  const first = property.values?.[0];
  if (first !== undefined) return JSON.stringify(first);
  if (property.kind === "boolean") return "false";
  if (property.kind === "number") return "0";
  if (property.kind === "string") return JSON.stringify(property.name === "label" ? "Example" : "");
  if (/=>|\bfunction\b/.test(property.type)) return "() => undefined";
  if (/\[\]|Array<|ReadonlyArray</.test(property.type)) return "[]";
  if (/ReactNode|JSX\.Element|null/.test(property.type)) return "null";
  return "undefined as never";
}

function propertyKey(value: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value) ? value : JSON.stringify(value);
}

function relativeImport(from: string, to: string): string {
  const withoutExtension = relative(dirname(from), to).replaceAll("\\", "/").replace(/\.[cm]?tsx?$/, "");
  return withoutExtension.startsWith(".") ? withoutExtension : `./${withoutExtension}`;
}

async function commitGeneratedDesign(root: string, sourcePath: string, designPath: string, source: string): Promise<void> {
  await assertStillRegistered(root, sourcePath);
  const parentPath = await realpath(dirname(designPath));
  const parent = await stat(parentPath);
  if (parentPath !== dirname(sourcePath)) throw new DesignSpaceError("ACCESS_DENIED", "The component directory changed before generation");
  await assertAbsent(designPath);
  const temporaryPath = `${parentPath}/.${basename(designPath)}.design-space-${randomUUID()}.tmp`;
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  let installed: Readonly<{ device: number; inode: number }> | undefined;
  try {
    handle = await open(temporaryPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o644);
    await handle.writeFile(source, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    const currentParent = await stat(parentPath);
    if (currentParent.dev !== parent.dev || currentParent.ino !== parent.ino || await realpath(parentPath) !== parentPath) {
      throw new DesignSpaceError("ACCESS_DENIED", "The component directory changed during generation");
    }
    await link(temporaryPath, designPath);
    const metadata = await lstat(designPath);
    installed = { device: metadata.dev, inode: metadata.ino };
    if (!metadata.isFile() || metadata.isSymbolicLink() || await realpath(designPath) !== designPath) {
      throw new DesignSpaceError("ACCESS_DENIED", "The generated design was not installed as a regular file");
    }
    await assertStillRegistered(root, designPath);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (installed) await removeInstalled(designPath, installed);
    if (error instanceof DesignSpaceError) throw error;
    if (isCode(error, "EEXIST")) throw new DesignSpaceError("STALE_SOURCE", "The design file was created concurrently");
    throw new DesignSpaceError("TRANSACTION_FAILED", "The design file could not be generated safely");
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}

async function assertAbsent(path: string): Promise<void> {
  try {
    await lstat(path);
    throw new DesignSpaceError("STALE_SOURCE", "The design file already exists");
  } catch (error) {
    if (error instanceof DesignSpaceError) throw error;
    if (!isCode(error, "ENOENT")) throw error;
  }
}

async function removeInstalled(path: string, expected: Readonly<{ device: number; inode: number }>): Promise<void> {
  const current = await lstat(path).catch((error) => isCode(error, "ENOENT") ? undefined : Promise.reject(error));
  if (!current) return;
  if (current.dev !== expected.device || current.ino !== expected.inode || current.isSymbolicLink()) {
    throw new DesignSpaceError("TRANSACTION_FAILED", "A failed design generation requires manual recovery");
  }
  await rm(path);
}

function isCode(error: unknown, code: string): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === code);
}
