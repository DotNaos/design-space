import { z } from "zod";

import { opaqueIdSchema } from "./ids";

export type DesignValue =
  | string
  | number
  | boolean
  | null
  | DesignValue[]
  | { [key: string]: DesignValue };

export interface DesignTextNode {
  kind: "text";
  id: string;
  value: string;
}

export interface DesignComponentNode {
  instanceId: string;
  adapterId: string;
  label?: string;
  props?: Record<string, DesignValue>;
  htmlClassNames?: Record<string, string>;
  propertyBindings?: Record<string, string>;
  slots: Record<string, DesignChild[]>;
}

export interface DesignComponentChild {
  kind: "component";
  node: DesignComponentNode;
}

export interface DesignSlotOutletNode {
  kind: "slot-outlet";
  id: string;
  slotId: string;
}

export type DesignChild = DesignTextNode | DesignComponentChild | DesignSlotOutletNode;

interface ComponentPropertyDraftBase {
  id: string;
  label: string;
  prop: string;
  section?: "content" | "layout" | "style" | "behavior" | "advanced";
  description?: string;
  required?: boolean;
  defaultValue?: DesignValue;
}

export type ComponentPropertyDraft =
  | (ComponentPropertyDraftBase & { kind: "text"; multiline?: boolean; maxLength?: number; placeholder?: string })
  | (ComponentPropertyDraftBase & { kind: "tailwind"; presets?: Array<{ id: string; label: string; value: string }> })
  | (ComponentPropertyDraftBase & { kind: "boolean" })
  | (ComponentPropertyDraftBase & { kind: "number"; min?: number; max?: number; step?: number; unit?: string })
  | (ComponentPropertyDraftBase & { kind: "select"; options: Array<{ value: string | number; label: string }> });

export interface ComponentSlotDraft {
  id: string;
  label: string;
  min?: number;
  max?: number;
  accepts?: string[];
  acceptsText?: boolean;
}

export interface ComponentDefinitionDraft {
  id: string;
  label: string;
  group: string;
  description?: string;
  recipeId?: string;
  properties: ComponentPropertyDraft[];
  slots: ComponentSlotDraft[];
}

export interface DesignDocument {
  schemaVersion: 2;
  id: string;
  label: string;
  kind: "screen" | "component";
  root: DesignComponentNode | null;
  component?: ComponentDefinitionDraft;
}

const designValueSchema: z.ZodType<DesignValue> = z.lazy(() => z.union([
  z.string().max(100_000),
  z.number().finite(),
  z.boolean(),
  z.null(),
  z.array(designValueSchema).max(1_000),
  z.record(z.string().max(120), designValueSchema),
]));

const designTextNodeSchema: z.ZodType<DesignTextNode> = z.object({
  kind: z.literal("text"),
  id: opaqueIdSchema,
  value: z.string().max(100_000),
}).strict();

const designSlotOutletNodeSchema: z.ZodType<DesignSlotOutletNode> = z.object({
  kind: z.literal("slot-outlet"),
  id: opaqueIdSchema,
  slotId: opaqueIdSchema,
}).strict();

export const designComponentNodeSchema: z.ZodType<DesignComponentNode> = z.lazy(() => z.object({
  instanceId: opaqueIdSchema,
  adapterId: opaqueIdSchema,
  label: z.string().trim().min(1).max(120).optional(),
  props: z.record(opaqueIdSchema, designValueSchema).optional(),
  htmlClassNames: z.record(opaqueIdSchema, z.string().max(10_000)).optional(),
  propertyBindings: z.record(opaqueIdSchema, opaqueIdSchema).optional(),
  slots: z.record(opaqueIdSchema, z.array(designChildSchema).max(500)),
}).strict().superRefine((node, context) => {
  if (Object.keys(node.htmlClassNames ?? {}).length > 200) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["htmlClassNames"], message: "Too many internal HTML style overrides" });
  }
  if (Object.keys(node.propertyBindings ?? {}).length > 80) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["propertyBindings"], message: "Too many property bindings" });
  }
}));

const designChildSchema: z.ZodType<DesignChild> = z.lazy(() => z.union([
  designTextNodeSchema,
  z.object({ kind: z.literal("component"), node: designComponentNodeSchema }).strict(),
  designSlotOutletNodeSchema,
]));

const propertyDraftBase = {
  id: opaqueIdSchema,
  label: z.string().trim().min(1).max(80),
  prop: opaqueIdSchema,
  section: z.enum(["content", "layout", "style", "behavior", "advanced"]).optional(),
  description: z.string().trim().max(300).optional(),
  required: z.boolean().optional(),
  defaultValue: designValueSchema.optional(),
};

const propertyDraftSchema: z.ZodType<ComponentPropertyDraft> = z.union([
  z.object({ ...propertyDraftBase, kind: z.literal("text"), multiline: z.boolean().optional(), maxLength: z.number().int().min(1).max(100_000).optional(), placeholder: z.string().max(200).optional() }).strict(),
  z.object({
    ...propertyDraftBase,
    kind: z.literal("tailwind"),
    presets: z.array(z.object({ id: opaqueIdSchema, label: z.string().trim().min(1).max(80), value: z.string().max(10_000) }).strict()).max(100).optional(),
  }).strict(),
  z.object({ ...propertyDraftBase, kind: z.literal("boolean") }).strict(),
  z.object({
    ...propertyDraftBase,
    kind: z.literal("number"),
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
    step: z.number().finite().positive().optional(),
    unit: z.string().trim().max(20).optional(),
  }).strict().superRefine((property, context) => {
    if (property.min !== undefined && property.max !== undefined && property.min > property.max) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Property minimum cannot exceed maximum" });
    }
  }),
  z.object({
    ...propertyDraftBase,
    kind: z.literal("select"),
    options: z.array(z.object({
      value: z.union([z.string().max(120), z.number().finite()]),
      label: z.string().trim().min(1).max(80),
    }).strict()).min(1).max(100),
  }).strict(),
]);

const slotDraftSchema: z.ZodType<ComponentSlotDraft> = z.object({
  id: opaqueIdSchema,
  label: z.string().trim().min(1).max(80),
  min: z.number().int().min(0).optional(),
  max: z.number().int().min(1).optional(),
  accepts: z.array(opaqueIdSchema).max(100).optional(),
  acceptsText: z.boolean().optional(),
}).strict().superRefine((slot, context) => {
  if (slot.min !== undefined && slot.max !== undefined && slot.min > slot.max) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Slot minimum cannot exceed maximum" });
  }
});

const componentDefinitionDraftSchema: z.ZodType<ComponentDefinitionDraft> = z.object({
  id: opaqueIdSchema,
  label: z.string().trim().min(1).max(120),
  group: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional(),
  recipeId: opaqueIdSchema.optional(),
  properties: z.array(propertyDraftSchema).max(80),
  slots: z.array(slotDraftSchema).max(40),
}).strict().superRefine((component, context) => {
  for (const [key, values] of [["properties", component.properties], ["slots", component.slots]] as const) {
    const ids = values.map((value) => value.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: `Duplicate ${key} IDs` });
    }
  }
  const propertyProps = component.properties.map((property) => property.prop);
  if (new Set(propertyProps).size !== propertyProps.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["properties"], message: "Duplicate property prop names" });
  }
});

export const designDocumentSchema: z.ZodType<DesignDocument> = z.object({
  schemaVersion: z.literal(2),
  id: opaqueIdSchema,
  label: z.string().trim().min(1).max(120),
  kind: z.enum(["screen", "component"]),
  root: designComponentNodeSchema.nullable(),
  component: componentDefinitionDraftSchema.optional(),
}).strict().superRefine((document, context) => {
  if (document.kind === "component" && !document.component) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["component"], message: "Component documents require a definition" });
  }
  if (document.kind === "screen" && document.component !== undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["component"], message: "Screen documents cannot define a component" });
  }
});
