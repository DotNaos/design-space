import { z } from "zod";

export const opaqueIdSchema = z
  .string()
  .min(1)
  .max(96)
  .regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/i, "Expected an opaque identifier");

export const sourceVersionSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const slotDefinitionSchema = z
  .object({
    id: opaqueIdSchema,
    label: z.string().trim().min(1).max(80),
    accepts: z.array(opaqueIdSchema).max(100).optional(),
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

export const componentDescriptorSchema = z
  .object({
    id: opaqueIdSchema,
    label: z.string().trim().min(1).max(120),
    group: z.string().trim().min(1).max(80),
    description: z.string().trim().max(500).optional(),
    sourceFileId: opaqueIdSchema.optional(),
    slots: z.array(slotDefinitionSchema).max(40),
    internalHtml: z
      .array(z.object({ id: opaqueIdSchema, tagName: z.string().regex(/^[a-z][a-z0-9-]*$/) }).strict())
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
  });

export type ComponentDescriptor = z.infer<typeof componentDescriptorSchema>;

export const browserOperationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("compile-tailwind"), value: z.string().max(10_000) }).strict(),
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
