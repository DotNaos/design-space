import { readFile } from "node:fs/promises";

import { z } from "zod";

import { componentDescriptorSchema, opaqueIdSchema } from "../shared/contracts";
import type { TargetModule } from "../shared/target-module";
import { DesignSpaceError } from "./errors";
import { canonicalRegisteredFile, canonicalRoot } from "./path-security";

export interface EditValidationContext {
  fileId: string;
  editTargetId: string;
  source: string;
}

export interface TrustedEditTarget {
  fileId: string;
  marker: string;
  compiler?: "tsx";
  validate?: (value: string, context: EditValidationContext) => void | Promise<void>;
  compile?: (nextSource: string, context: EditValidationContext) => void | Promise<void>;
}

export interface TrustedTargetConfig {
  project: { id: string; label: string };
  root: string;
  targetModule: string;
  files: Readonly<Record<string, string>>;
  editTargets: Readonly<Record<string, TrustedEditTarget>>;
}

export interface RegisteredFile {
  id: string;
  path: string;
  displayName: string;
}

export interface RegisteredEditTarget extends TrustedEditTarget {
  id: string;
}

export interface RegisteredTarget {
  project: { id: string; label: string };
  root: string;
  targetModulePath: string;
  files: ReadonlyMap<string, RegisteredFile>;
  editTargets: ReadonlyMap<string, RegisteredEditTarget>;
  registrationPath?: string;
}

const trustedConfigShape = z
  .object({
    project: z.object({ id: opaqueIdSchema, label: z.string().trim().min(1).max(120) }).strict(),
    root: z.string().min(1),
    targetModule: z.string().min(1),
    files: z.record(opaqueIdSchema, z.string().min(1)),
    editTargets: z.record(
      opaqueIdSchema,
      z
        .object({
          fileId: opaqueIdSchema,
          marker: z.string().min(1).max(200),
          compiler: z.enum(["tsx"]).optional(),
          validate: z.function().optional(),
          compile: z.function().optional(),
        })
        .strict(),
    ),
  })
  .strict();

export async function registerTrustedTarget(config: TrustedTargetConfig): Promise<RegisteredTarget> {
  const parsed = trustedConfigShape.safeParse(config);
  if (!parsed.success) {
    throw new DesignSpaceError("INVALID_REGISTRATION", "The server target registration is invalid");
  }

  const root = await canonicalRoot(config.root);
  const targetModulePath = await canonicalRegisteredFile(root, config.targetModule);
  const files = new Map<string, RegisteredFile>();
  for (const [id, relativePath] of Object.entries(config.files)) {
    files.set(id, {
      id,
      path: await canonicalRegisteredFile(root, relativePath),
      displayName: relativePath.replaceAll("\\", "/"),
    });
  }

  const editTargets = new Map<string, RegisteredEditTarget>();
  for (const [id, editTarget] of Object.entries(config.editTargets)) {
    const file = files.get(editTarget.fileId);
    if (!file) {
      throw new DesignSpaceError("INVALID_REGISTRATION", `Edit target ${id} references an unknown file`);
    }
    const source = await readFile(file.path, "utf8");
    if (source.split(editTarget.marker).length !== 2) {
      throw new DesignSpaceError(
        "INVALID_REGISTRATION",
        `Edit target ${id} marker must occur exactly once`,
      );
    }
    editTargets.set(id, { id, ...editTarget });
  }

  return {
    project: config.project,
    root,
    targetModulePath,
    files,
    editTargets,
  };
}

export function validateTargetModule(value: unknown): asserts value is TargetModule {
  if (!value || typeof value !== "object") {
    throw new DesignSpaceError("INVALID_ADAPTER", "The target module must export a target object");
  }
  const target = value as Partial<TargetModule>;
  const project = z
    .object({ id: opaqueIdSchema, label: z.string().trim().min(1).max(120) })
    .strict()
    .safeParse(target.project);
  if (!project.success || !Array.isArray(target.adapters) || !opaqueIdSchema.safeParse(target.defaultAdapterId).success) {
    throw new DesignSpaceError("INVALID_ADAPTER", "The target module shape is invalid");
  }
  const ids = new Set<string>();
  for (const adapter of target.adapters) {
    if (
      !adapter ||
      typeof adapter !== "object" ||
      typeof adapter.render !== "function" ||
      !componentDescriptorSchema.safeParse(adapter.component).success ||
      ids.has(adapter.component.id)
    ) {
      throw new DesignSpaceError("INVALID_ADAPTER", "A component adapter is invalid or duplicated");
    }
    ids.add(adapter.component.id);
  }
  if (!ids.has(target.defaultAdapterId as string)) {
    throw new DesignSpaceError("INVALID_ADAPTER", "The default component adapter does not exist");
  }
  if (!target.defaultFixture || target.defaultFixture.adapterId !== target.defaultAdapterId) {
    throw new DesignSpaceError("INVALID_ADAPTER", "The default fixture must use the default adapter");
  }
  if (target.defaultEditTargetId !== undefined && !opaqueIdSchema.safeParse(target.defaultEditTargetId).success) {
    throw new DesignSpaceError("INVALID_ADAPTER", "The default edit target ID is invalid");
  }
  const fileEntries = z.array(z.object({
    id: opaqueIdSchema,
    label: z.string().trim().min(1).max(120),
    kind: z.enum(["file", "directory"]),
    parentId: opaqueIdSchema.optional(),
  }).strict()).safeParse(target.files);
  if (!fileEntries.success || new Set(fileEntries.data.map((file) => file.id)).size !== fileEntries.data.length) {
    throw new DesignSpaceError("INVALID_ADAPTER", "The target file catalog is invalid");
  }
  validateFixture(target.defaultFixture, { adapters: target.adapters! }, new Set());
}

function validateFixture(
  fixture: TargetModule["defaultFixture"],
  target: Pick<TargetModule, "adapters">,
  instanceIds: Set<string>,
): void {
  if (!opaqueIdSchema.safeParse(fixture.instanceId).success || instanceIds.has(fixture.instanceId)) {
    throw new DesignSpaceError("INVALID_ADAPTER", "The target fixture has an invalid or duplicated instance");
  }
  instanceIds.add(fixture.instanceId);
  const adapter = target.adapters.find((item) => item.component.id === fixture.adapterId);
  if (!adapter || !fixture.slots || typeof fixture.slots !== "object" || Array.isArray(fixture.slots)) {
    throw new DesignSpaceError("INVALID_ADAPTER", "The target fixture references an invalid adapter");
  }
  const declaredSlots = new Set(adapter.component.slots.map((slot) => slot.id));
  if (Object.keys(fixture.slots).some((slotId) => !declaredSlots.has(slotId))) {
    throw new DesignSpaceError("INVALID_ADAPTER", "The target fixture uses an undeclared slot");
  }
  for (const children of Object.values(fixture.slots)) {
    if (!Array.isArray(children)) throw new DesignSpaceError("INVALID_ADAPTER", "Fixture slot content must be an array");
    for (const child of children) {
      if (child.kind === "component") validateFixture(child.node, target, instanceIds);
      else if (child.kind !== "text" || typeof child.value !== "string") {
        throw new DesignSpaceError("INVALID_ADAPTER", "Fixture children must be components or text");
      }
    }
  }
}
