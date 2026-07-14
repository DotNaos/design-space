import { z } from "zod";

import { opaqueIdSchema, sourceVersionSchema } from "./ids";

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
  children?: readonly InternalHtmlNode[];
}

const internalHtmlNodeSchema: z.ZodType<InternalHtmlNode> = z.lazy(() => z.object({
  id: opaqueIdSchema,
  tagName: z.string().regex(/^[a-z][a-z0-9-]*$/),
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
    validateInternalHtmlIds(component.internalHtml ?? [], ["internalHtml"], htmlIds, context);
  });

export type ComponentDescriptor = z.infer<typeof componentDescriptorSchema>;

function validateInternalHtmlIds(
  nodes: readonly InternalHtmlNode[],
  path: Array<string | number>,
  ids: Set<string>,
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
    validateInternalHtmlIds(node.children ?? [], [...path, index, "children"], ids, context);
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
  z.object({ type: z.literal("compile-tailwind"), value: z.string().max(10_000) }).strict(),
  z.object({ type: z.literal("read-project-file"), fileId: opaqueIdSchema }).strict(),
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
]);

export type BrowserOperation = z.infer<typeof browserOperationSchema>;

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

export interface TailwindPreview {
  value: string;
  css: string;
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
