import { z } from "zod";

import { opaqueIdSchema, sourceVersionSchema } from "./ids";
import type { SourceDesignScope } from "./source-design";
import type { SourceComponentProp, SourceComponentSlot, SourceStrictUiFinding, SourceWorkspaceLayer } from "./source-workspace";

export { opaqueIdSchema, sourceVersionSchema } from "./ids";

export const slotDefinitionSchema = z
  .object({
    id: opaqueIdSchema,
    label: z.string().trim().min(1).max(80),
    accepts: z.array(opaqueIdSchema).max(100).optional(),
    acceptsText: z.boolean().optional(),
    min: z.number().int().min(0).optional(),
    max: z.number().int().min(1).optional(),
  })
  .strict()
  .superRefine((slot, context) => {
    if (slot.min !== undefined && slot.max !== undefined && slot.min > slot.max) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Slot minimum cannot exceed its maximum",
        path: ["min"],
      });
    }
  });

export type SlotDefinition = z.infer<typeof slotDefinitionSchema>;

export interface InternalHtmlNode {
  id: string;
  tagName: string;
  slotId?: string;
  children?: readonly InternalHtmlNode[];
}

const internalHtmlNodeSchema: z.ZodType<InternalHtmlNode> = z.lazy(() => z.object({
  id: opaqueIdSchema,
  tagName: z.string().regex(/^[a-z][a-z0-9-]*$/),
  slotId: opaqueIdSchema.optional(),
  children: z.array(internalHtmlNodeSchema).max(200).optional(),
}).strict());

export const componentDescriptorSchema = z
  .object({
    id: opaqueIdSchema,
    label: z.string().trim().min(1).max(120),
    group: z.string().trim().min(1).max(80),
    description: z.string().trim().max(500).optional(),
    sourceFileId: opaqueIdSchema.optional(),
    slots: z.array(slotDefinitionSchema).max(40),
    internalHtml: z
      .array(internalHtmlNodeSchema)
      .max(200)
      .optional(),
  })
  .strict()
  .superRefine((component, context) => {
    const ids = new Set<string>();
    for (const [index, slot] of component.slots.entries()) {
      if (ids.has(slot.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate slot identifier: ${slot.id}`,
          path: ["slots", index, "id"],
        });
      }
      ids.add(slot.id);
    }
    const htmlIds = new Set<string>();
    validateInternalHtmlIds(component.internalHtml ?? [], ["internalHtml"], htmlIds, ids, context);
  });

export type ComponentDescriptor = z.infer<typeof componentDescriptorSchema>;

function validateInternalHtmlIds(
  nodes: readonly InternalHtmlNode[],
  path: Array<string | number>,
  ids: Set<string>,
  slotIds: ReadonlySet<string>,
  context: z.RefinementCtx,
): void {
  for (const [index, node] of nodes.entries()) {
    if (ids.has(node.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate internal HTML identifier: ${node.id}`,
        path: [...path, index, "id"],
      });
    }
    ids.add(node.id);
    if (node.slotId && !slotIds.has(node.slotId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Internal HTML references undeclared slot: ${node.slotId}`,
        path: [...path, index, "slotId"],
      });
    }
    validateInternalHtmlIds(node.children ?? [], [...path, index, "children"], ids, slotIds, context);
  }
}

const componentControlBase = {
  id: opaqueIdSchema,
  label: z.string().trim().min(1).max(80),
  prop: opaqueIdSchema,
  section: z.enum(["content", "layout", "style", "behavior", "advanced"]).optional(),
  description: z.string().trim().max(300).optional(),
  required: z.boolean().optional(),
};

const componentControlUnionSchema = z.discriminatedUnion("kind", [
  z.object({
    ...componentControlBase,
    kind: z.literal("text"),
    multiline: z.boolean().optional(),
    maxLength: z.number().int().min(1).max(100_000).optional(),
    placeholder: z.string().max(200).optional(),
  }).strict(),
  z.object({
    ...componentControlBase,
    kind: z.literal("tailwind"),
    presets: z.array(z.object({
      id: opaqueIdSchema,
      label: z.string().trim().min(1).max(80),
      value: z.string().max(10_000),
    }).strict()).max(100).optional(),
  }).strict(),
  z.object({ ...componentControlBase, kind: z.literal("boolean") }).strict(),
  z.object({
    ...componentControlBase,
    kind: z.literal("number"),
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
    step: z.number().finite().positive().optional(),
    unit: z.string().trim().max(20).optional(),
  }).strict(),
  z.object({
    ...componentControlBase,
    kind: z.literal("select"),
    options: z.array(z.object({
      id: opaqueIdSchema,
      label: z.string().trim().min(1).max(80),
      value: z.union([z.string().max(120), z.number().finite()]),
    }).strict()).min(1).max(100),
  }).strict(),
]);

export const componentControlSchema = componentControlUnionSchema.superRefine((control, context) => {
  if (control.kind === "number" && control.min !== undefined && control.max !== undefined && control.min > control.max) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Control minimum cannot exceed maximum" });
  }
});

export type ComponentControl = z.infer<typeof componentControlSchema>;

export const browserOperationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("compile-tailwind"),
    value: z.string().max(10_000),
    scope: z.enum(["app", "library-development"]).optional(),
  }).strict(),
  z.object({ type: z.literal("analyze-tailwind"), value: z.string().max(10_000), cursor: z.number().int().min(0).max(10_000) }).strict(),
  z.object({
    type: z.literal("read-project-file"),
    fileId: opaqueIdSchema,
    scope: z.enum(["app", "library-development"]).optional(),
  }).strict(),
  z.object({
    type: z.literal("analyze-source-file-draft"),
    fileId: opaqueIdSchema,
    source: z.string().max(512 * 1024),
    scope: z.enum(["app", "library-development"]).optional(),
  }).strict(),
  z.object({
    type: z.literal("prepare-project-file-edit"),
    fileId: opaqueIdSchema,
    baseVersion: sourceVersionSchema,
    source: z.string().max(512 * 1024),
  }).strict(),
  z.object({ type: z.literal("save-project-file-edit"), challengeId: z.string().uuid() }).strict(),
  z.object({
    type: z.literal("prepare-source-change-set"),
    scope: z.enum(["app", "library-development"]),
    supersedesChallengeId: z.string().uuid().optional(),
    changes: z.array(z.object({
      fileId: opaqueIdSchema,
      baseVersion: sourceVersionSchema,
      source: z.string().max(512 * 1024),
    }).strict()).min(1).max(50),
  }).strict(),
  z.object({ type: z.literal("apply-source-change-set"), challengeId: z.string().uuid() }).strict(),
  z.object({
    type: z.literal("prepare-source-component-create"),
    name: z.string().trim().regex(/^[A-Z][A-Za-z0-9]{1,63}$/),
  }).strict(),
  z.object({ type: z.literal("save-source-component-create"), challengeId: z.string().uuid() }).strict(),
  z.object({
    type: z.literal("generate-source-design"),
    scope: z.enum(["app", "library-development"]),
    entryId: opaqueIdSchema,
  }).strict(),
  z.object({ type: z.literal("read-source"), editTargetId: opaqueIdSchema }).strict(),
  z
    .object({
      type: z.literal("prepare-edit"),
      editTargetId: opaqueIdSchema,
      baseVersion: sourceVersionSchema,
      value: z.string().max(10_000),
    })
    .strict(),
  z.object({ type: z.literal("save-edit"), challengeId: z.string().uuid() }).strict(),
]).superRefine((operation, context) => {
  if (operation.type === "analyze-tailwind" && operation.cursor > operation.value.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["cursor"], message: "Tailwind cursor exceeds the class field" });
  }
});

export type BrowserOperation = z.infer<typeof browserOperationSchema>;

export const libraryDevelopmentOperationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("get-library-development") }).strict(),
  z.object({ type: z.literal("clone-library-development") }).strict(),
  z.object({
    type: z.literal("start-library-development"),
    worktreeId: opaqueIdSchema,
  }).strict(),
  z.object({ type: z.literal("stop-library-development") }).strict(),
]);

export type LibraryDevelopmentOperation = z.infer<typeof libraryDevelopmentOperationSchema>;

export interface SourceSnapshot {
  editTargetId: string;
  value: string;
  version: string;
}

export interface ProjectFileSnapshot {
  fileId: string;
  label: string;
  source: string;
  version: string;
}

export interface SourceDraftComponent {
  filePath: string;
  exportName: string;
  label: string;
  props: readonly SourceComponentProp[];
  slots: readonly SourceComponentSlot[];
  findings: readonly SourceStrictUiFinding[];
  source: { start: number; end: number };
  uses: readonly string[];
  layers: readonly SourceWorkspaceLayer[];
}

export interface SourceDraftAnalysis {
  fileId: string;
  components: readonly SourceDraftComponent[];
}

export interface PreparedProjectFileEdit {
  challengeId: string;
  fileId: string;
  baseVersion: string;
  nextVersion: string;
  diff: string;
  expiresAt: string;
}

export interface SavedProjectFileEdit extends ProjectFileSnapshot {
  previousVersion: string;
}

export interface SourceChangeReviewEvidence {
  changeId: string;
  fileId: string;
  label: string;
  baseVersion: string;
  nextVersion: string;
  beforeSource: string;
  afterSource: string;
  diff: string;
}

export interface PreparedSourceChangeSet {
  state: "source-change-set-ready";
  challengeId: string;
  scope: SourceDesignScope;
  changes: readonly SourceChangeReviewEvidence[];
  expiresAt: string;
}

export interface AppliedSourceChangeSet {
  state: "source-change-set-applied";
  scope: SourceDesignScope;
  changes: readonly {
    changeId: string;
    fileId: string;
    label: string;
    previousVersion: string;
    version: string;
  }[];
}

export interface PreparedSourceComponentCreate {
  state: "source-component-create-ready";
  challengeId: string;
  name: string;
  relativePath: string;
  diff: string;
  expiresAt: string;
}

export interface SavedSourceComponentCreate {
  state: "source-component-created";
  name: string;
  relativePath: string;
}

export interface GeneratedSourceDesign {
  state: "source-design-generated";
  scope: SourceDesignScope;
  entryId: string;
  relativePath: string;
}

export interface TailwindPreview {
  value: string;
  css: string;
}

export interface TailwindCompletion {
  label: string;
  insertText: string;
  replaceStart: number;
  replaceEnd: number;
  detail?: string;
  documentation?: string;
}

export interface TailwindDiagnostic {
  code?: string;
  message: string;
  severity: "error" | "warning" | "information";
  start: number;
  end: number;
}

export interface TailwindIntelligence {
  value: string;
  cursor: number;
  engineVersion: string;
  completions: readonly TailwindCompletion[];
  diagnostics: readonly TailwindDiagnostic[];
}

export interface PreparedEdit {
  challengeId: string;
  editTargetId: string;
  baseVersion: string;
  nextVersion: string;
  diff: string;
  expiresAt: string;
}

export interface SavedEdit extends SourceSnapshot {
  previousVersion: string;
}
