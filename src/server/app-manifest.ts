import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { z } from "zod";

import type { DesignSpaceDevice, DesignSpaceRuntime } from "../shared/source-workspace";
import { DesignSpaceError } from "./errors";
import { canonicalRegisteredFile, canonicalRoot } from "./path-security";

export const APP_MANIFEST_FILE = "app.manifest.json";

// Schema parity source: DotNaos/project-template@4d39611f2f79a181944c560220ed9afb39e916a4
// packages/config/src/app-manifest.ts and schema.template/app-manifest.schema.json.

const projectPath = z.string().refine(isNormalizedProjectPath, {
  message: "Must be a normalized project-relative path",
});
const targetId = z.string().regex(/^[a-z][a-z0-9-]*$/);
const appId = z.string().regex(/^[a-z][a-z0-9-]*$/);
const exportName = z.union([z.literal("default"), z.string().regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/)]);
const rootSchema = z.object({
  source: projectPath.refine((value) => value.endsWith(".tsx"), "Must name a .tsx source file"),
  export: exportName,
}).strict();
const deviceSchema = z.object({ root: rootSchema }).strict();
const targetSchema = z.object({
  runtime: z.enum(["react", "react-native", "electron"]),
  sourceRoot: projectPath,
  entrypoint: projectPath,
  devices: z.object({
    desktop: deviceSchema.optional(),
    tablet: deviceSchema.optional(),
    mobile: deviceSchema.optional(),
  }).strict().refine((devices) => Object.keys(devices).length > 0, "Declare at least one device"),
}).strict();
const manifestSchema = z.object({
  $schema: z.string().optional(),
  version: z.literal(1),
  app: z.object({
    id: appId,
    displayName: z.string().min(1).regex(/\S/),
  }).strict(),
  targets: z.record(targetId, targetSchema).refine((targets) => Object.keys(targets).length > 0, "Declare at least one target"),
}).strict();

export interface AppManifestRoot {
  source: string;
  export: string;
}

export interface AppManifestTarget {
  runtime: DesignSpaceRuntime;
  sourceRoot: string;
  entrypoint: string;
  devices: Partial<Record<DesignSpaceDevice, { root: AppManifestRoot }>>;
}

export interface AppManifest {
  $schema?: string;
  version: 1;
  app: { id: string; displayName: string };
  targets: Readonly<Record<string, AppManifestTarget>>;
}

export function parseAppManifest(value: unknown): AppManifest {
  const parsed = manifestSchema.safeParse(value);
  if (!parsed.success) {
    throw new DesignSpaceError(
      "INVALID_REGISTRATION",
      `app.manifest.json is invalid: ${formatIssues(parsed.error.issues)}`,
    );
  }
  for (const [id, target] of Object.entries(parsed.data.targets)) validateTargetPaths(id, target);
  return parsed.data;
}

export async function loadAppManifest(unsafeRoot: string): Promise<{ manifest: AppManifest; path: string; root: string }> {
  const root = await canonicalRoot(unsafeRoot);
  const path = await canonicalRegisteredFile(root, APP_MANIFEST_FILE);
  let value: unknown;
  try {
    value = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new DesignSpaceError(
      "INVALID_REGISTRATION",
      `app.manifest.json could not be read: ${error instanceof Error ? error.message : "invalid JSON"}`,
    );
  }
  return { manifest: parseAppManifest(value), path, root };
}

function validateTargetPaths(id: string, target: z.infer<typeof targetSchema>) {
  if (!isWithin(target.entrypoint, target.sourceRoot)) {
    throw invalidPath(id, "entrypoint", target.entrypoint, target.sourceRoot);
  }
  const roots = Object.entries(target.devices) as [DesignSpaceDevice, { root: AppManifestRoot }][];
  for (const [device, definition] of roots) {
    if (!isWithin(definition.root.source, target.sourceRoot)) {
      throw invalidPath(id, `devices.${device}.root.source`, definition.root.source, target.sourceRoot);
    }
  }
  const usage = new Map<string, DesignSpaceDevice[]>();
  for (const [device, definition] of roots) {
    const key = `${definition.root.source}#${definition.root.export}`;
    usage.set(key, [...(usage.get(key) ?? []), device]);
  }
  for (const [key, devices] of usage) {
    const source = key.slice(0, key.lastIndexOf("#"));
    if (devices.length === 1 && !source.endsWith(`.${devices[0]}.tsx`)) {
      throw new DesignSpaceError(
        "INVALID_REGISTRATION",
        `targets.${id}.devices.${devices[0]}.root.source must use a .${devices[0]}.tsx filename when only that device uses it`,
      );
    }
    if (devices.length > 1 && /\.(?:desktop|tablet|mobile)\.tsx$/.test(source)) {
      throw new DesignSpaceError(
        "INVALID_REGISTRATION",
        `targets.${id} shared device root ${source} must use a device-neutral filename`,
      );
    }
  }
}

function invalidPath(target: string, field: string, value: string, sourceRoot: string) {
  return new DesignSpaceError(
    "INVALID_REGISTRATION",
    `targets.${target}.${field} (${value}) must be inside sourceRoot ${sourceRoot}`,
  );
}

function isWithin(path: string, directory: string) {
  return path === directory || path.startsWith(`${directory}/`);
}

function isNormalizedProjectPath(value: string) {
  return value.length > 0
    && !value.startsWith("/")
    && !value.startsWith("./")
    && !value.endsWith("/")
    && !value.includes("\\")
    && !value.includes("//")
    && value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function formatIssues(issues: readonly z.ZodIssue[]) {
  return issues.map((issue) => `${issue.path.length ? issue.path.join(".") : "manifest"}: ${issue.message}`).join("; ");
}
