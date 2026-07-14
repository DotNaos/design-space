import { readFile } from "node:fs/promises";

import { z } from "zod";

import { componentControlSchema, componentDescriptorSchema, opaqueIdSchema } from "../shared/contracts";
import type { DesignDocument } from "../shared/design-document";
import type { StrictUiViolation } from "../shared/strict-ui";
import type { TargetModule } from "../shared/target-module";
import { DesignSpaceError } from "./errors";
import {
  registerManagedDocumentStore,
  type RegisteredManagedDocumentStore,
  type TrustedManagedDocumentStore,
} from "./managed-document-registration";
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

export interface TailwindCompilerContext {
  projectId: string;
  /** Frozen source snapshot loaded from fixed server-registered file IDs. */
  sources: Readonly<Record<string, string>>;
  /** Frozen content hashes for the same source snapshot. */
  sourceVersions: Readonly<Record<string, string>>;
}

export interface TrustedTailwindCompiler {
  sourceFileIds: readonly string[];
  compile: (classList: string, context: TailwindCompilerContext) => string | Promise<string>;
}

export interface DocumentTargetContext {
  projectId: string;
  documentId: string;
  registrationVersion: string;
  sources: Readonly<Record<string, string>>;
  /** Server-loaded snapshot; document operations never accept this from the browser. */
  libraryDocuments: readonly DesignDocument[];
}

export interface ManagedDocumentRecipeContext {
  projectId: string;
  documentId: string;
  recipeId: string;
  registrationVersion: string;
}

export interface TrustedDocumentTarget {
  sourceFileIds: readonly string[];
  writeFileIds: readonly string[];
  load: (sources: Readonly<Record<string, string>>, context: DocumentTargetContext) => unknown | Promise<unknown>;
  materialize: (
    document: DesignDocument,
    context: DocumentTargetContext,
  ) => Readonly<Record<string, string>> | Promise<Readonly<Record<string, string>>>;
  strictUi?: (
    document: DesignDocument,
    context: DocumentTargetContext,
  ) => readonly StrictUiViolation[] | Promise<readonly StrictUiViolation[]>;
  compile?: (
    nextSources: Readonly<Record<string, string>>,
    context: DocumentTargetContext,
  ) => void | Promise<void>;
}

export interface TrustedDocumentRegistration {
  version: string;
  /** Trusted server callback that derives the complete Tailwind class graph for a document. */
  tailwindClassList: (
    document: DesignDocument,
    context: DocumentTargetContext,
  ) => string | Promise<string>;
  documents: Readonly<Record<string, TrustedDocumentTarget>>;
  managed?: TrustedManagedDocumentStore;
}

export interface TrustedTargetConfig {
  project: { id: string; label: string };
  root: string;
  targetModule: string;
  files: Readonly<Record<string, string>>;
  editTargets: Readonly<Record<string, TrustedEditTarget>>;
  /** Trusted server callback; never selected or configured by a browser operation. */
  tailwindCompiler?: TrustedTailwindCompiler;
  documentRegistration?: TrustedDocumentRegistration;
}

export interface RegisteredFile {
  id: string;
  path: string;
  displayName: string;
}

export interface RegisteredEditTarget extends TrustedEditTarget {
  id: string;
}

export interface RegisteredDocumentTarget extends TrustedDocumentTarget {
  id: string;
  origin: "registered" | "managed";
  sourceFileIds: readonly string[];
  writeFileIds: readonly string[];
}

export interface RegisteredDocumentRegistration {
  version: string;
  tailwindClassList: TrustedDocumentRegistration["tailwindClassList"];
  documents: Map<string, RegisteredDocumentTarget>;
  managed?: RegisteredManagedDocumentStore;
}

export interface RegisteredTarget {
  project: { id: string; label: string };
  root: string;
  targetModulePath: string;
  files: Map<string, RegisteredFile>;
  editTargets: ReadonlyMap<string, RegisteredEditTarget>;
  tailwindCompiler?: TrustedTailwindCompiler;
  documentRegistration?: RegisteredDocumentRegistration;
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
    tailwindCompiler: z.object({
      sourceFileIds: z.array(opaqueIdSchema).max(50),
      compile: z.function(),
    }).strict().optional(),
    documentRegistration: z.object({
      version: z.string().trim().min(1).max(120),
      tailwindClassList: z.function(),
      documents: z.record(opaqueIdSchema, z.object({
        sourceFileIds: z.array(opaqueIdSchema).min(1).max(200),
        writeFileIds: z.array(opaqueIdSchema).min(1).max(200),
        load: z.function(),
        materialize: z.function(),
        strictUi: z.function().optional(),
        compile: z.function().optional(),
      }).strict()),
      managed: z.object({
        directory: z.string().min(1),
        recipes: z.record(opaqueIdSchema, z.object({
          label: z.string().trim().min(1).max(120),
          description: z.string().trim().max(500).optional(),
          kind: z.enum(["screen", "component"]),
          create: z.function(),
        }).strict()),
        strictUi: z.function().optional(),
        compile: z.function().optional(),
      }).strict().optional(),
    }).strict().optional(),
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

  let tailwindCompiler: TrustedTailwindCompiler | undefined;
  if (config.tailwindCompiler) {
    const sourceFileIds = [...config.tailwindCompiler.sourceFileIds];
    if (
      new Set(sourceFileIds).size !== sourceFileIds.length ||
      sourceFileIds.some((fileId) => !files.has(fileId))
    ) {
      throw new DesignSpaceError(
        "INVALID_REGISTRATION",
        "The Tailwind compiler must use unique registered source files",
      );
    }
    tailwindCompiler = {
      sourceFileIds: Object.freeze(sourceFileIds),
      compile: config.tailwindCompiler.compile,
    };
  }

  let documentRegistration: RegisteredDocumentRegistration | undefined;
  if (config.documentRegistration) {
    const documents = new Map<string, RegisteredDocumentTarget>();
    for (const [id, document] of Object.entries(config.documentRegistration.documents)) {
      const sourceFileIds = [...document.sourceFileIds];
      const writeFileIds = [...document.writeFileIds];
      if (
        new Set(sourceFileIds).size !== sourceFileIds.length ||
        new Set(writeFileIds).size !== writeFileIds.length ||
        writeFileIds.some((fileId) => !sourceFileIds.includes(fileId))
      ) {
        throw new DesignSpaceError(
          "INVALID_REGISTRATION",
          `Document ${id} must use unique registered write files from its source set`,
        );
      }
      for (const fileId of sourceFileIds) {
        if (!files.has(fileId)) {
          throw new DesignSpaceError("INVALID_REGISTRATION", `Document ${id} references an unknown file`);
        }
      }
      documents.set(id, { id, origin: "registered", ...document, sourceFileIds, writeFileIds });
    }
    const managed = config.documentRegistration.managed
      ? await registerManagedDocumentStore({
          root,
          config: config.documentRegistration.managed,
          files,
          documents,
        })
      : undefined;
    if (documents.size > 500) {
      throw new DesignSpaceError("INVALID_REGISTRATION", "The document catalog exceeds 500 documents");
    }
    documentRegistration = {
      version: config.documentRegistration.version,
      tailwindClassList: config.documentRegistration.tailwindClassList,
      documents,
      managed,
    };
  }

  return {
    project: config.project,
    root,
    targetModulePath,
    files,
    editTargets,
    tailwindCompiler,
    documentRegistration,
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
    const controls = z.array(componentControlSchema).max(40).safeParse(adapter?.controls ?? []);
    const controlIds = controls.success ? controls.data.map((control) => control.id) : [];
    const controlProps = controls.success ? controls.data.map((control) => control.prop) : [];
    if (
      !adapter ||
      typeof adapter !== "object" ||
      typeof adapter.render !== "function" ||
      !componentDescriptorSchema.safeParse(adapter.component).success ||
      !controls.success ||
      new Set(controlIds).size !== controlIds.length ||
      new Set(controlProps).size !== controlProps.length ||
      (adapter.defaultProps !== undefined && (!adapter.defaultProps || typeof adapter.defaultProps !== "object" || Array.isArray(adapter.defaultProps))) ||
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
  const documents = z.array(z.object({
    id: opaqueIdSchema,
    label: z.string().trim().min(1).max(120),
    kind: z.enum(["screen", "component"]),
    group: z.string().trim().min(1).max(80).optional(),
  }).strict()).max(500).safeParse(target.documents ?? []);
  if (!documents.success || new Set(documents.data.map((document) => document.id)).size !== documents.data.length) {
    throw new DesignSpaceError("INVALID_ADAPTER", "The target document catalog is invalid or duplicated");
  }
  if (
    target.defaultDocumentId !== undefined &&
    (!opaqueIdSchema.safeParse(target.defaultDocumentId).success ||
      !documents.data.some((document) => document.id === target.defaultDocumentId))
  ) {
    throw new DesignSpaceError("INVALID_ADAPTER", "The default document does not exist in the document catalog");
  }
  const recipes = z.array(z.object({
    id: opaqueIdSchema,
    label: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).optional(),
    rootAdapterId: opaqueIdSchema,
    rootSlotId: opaqueIdSchema,
  }).strict()).max(100).safeParse(target.componentRecipes ?? []);
  if (!recipes.success || new Set(recipes.data.map((recipe) => recipe.id)).size !== recipes.data.length) {
    throw new DesignSpaceError("INVALID_ADAPTER", "The component recipe catalog is invalid or duplicated");
  }
  for (const recipe of recipes.data) {
    const adapter = target.adapters.find((candidate) => candidate.component.id === recipe.rootAdapterId);
    if (
      !adapter ||
      !adapter.component.slots.some((slot: { id: string }) => slot.id === recipe.rootSlotId)
    ) {
      throw new DesignSpaceError("INVALID_ADAPTER", "A component recipe references an unavailable adapter slot");
    }
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
