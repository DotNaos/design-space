import type {
  ComponentProps,
  ComponentType,
  ReactElement,
} from "react";
import { z } from "zod";

import { opaqueIdSchema, sourceVersionSchema } from "./ids";

declare const strictUiSlotCardinality: unique symbol;

/** One explicitly typed Strict UI component insertion point. */
export type ComponentSlot<Allowed extends ComponentType<any>> =
  ReactElement<ComponentProps<Allowed>, Allowed>;

/**
 * An ordered Strict UI slot collection. Min and Max are compiler-visible
 * contract metadata consumed by Design Space validation.
 */
export type ComponentSlotList<
  Allowed extends ComponentType<any>,
  Min extends number = 0,
  Max extends number = number,
> = readonly ComponentSlot<Allowed>[] & {
  readonly [strictUiSlotCardinality]?: readonly [Min, Max];
};

/** Explicitly rejects React's implicit children composition. */
export interface StrictUiProps {
  children?: never;
}

export const strictUiSeveritySchema = z.enum(["error", "warning", "info"]);
export type StrictUiSeverity = z.infer<typeof strictUiSeveritySchema>;

export const strictUiLocationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("document") }).strict(),
  z.object({ kind: z.literal("instance"), instanceId: opaqueIdSchema }).strict(),
  z.object({ kind: z.literal("slot"), instanceId: opaqueIdSchema, slotId: opaqueIdSchema }).strict(),
  z.object({
    kind: z.literal("control"),
    instanceId: opaqueIdSchema,
    controlId: opaqueIdSchema,
  }).strict(),
  z.object({
    kind: z.literal("slot-outlet"),
    slotId: opaqueIdSchema,
    outletId: opaqueIdSchema.optional(),
  }).strict(),
]);

export type StrictUiLocation = z.infer<typeof strictUiLocationSchema>;

export const strictUiViolationSchema = z.object({
  ruleId: opaqueIdSchema,
  severity: strictUiSeveritySchema,
  message: z.string().trim().min(1).max(500),
  location: strictUiLocationSchema,
  suggestion: z.string().trim().min(1).max(500).optional(),
}).strict();

export type StrictUiViolation = z.infer<typeof strictUiViolationSchema>;

export const strictUiEvidenceSchema = z.object({
  id: opaqueIdSchema,
  projectId: opaqueIdSchema,
  documentId: opaqueIdSchema,
  basis: z.object({
    documentDigest: sourceVersionSchema,
    sourceVersion: sourceVersionSchema,
    ruleSetVersion: z.string().trim().min(1).max(120),
  }).strict(),
  status: z.enum(["passed", "warnings", "blocked"]),
  checkedAt: z.string().datetime(),
  violations: z.array(strictUiViolationSchema).max(2_000),
}).strict();

export type StrictUiEvidence = z.infer<typeof strictUiEvidenceSchema>;

export function strictUiStatus(violations: readonly StrictUiViolation[]): StrictUiEvidence["status"] {
  if (violations.some((violation) => violation.severity === "error")) return "blocked";
  if (violations.some((violation) => violation.severity === "warning")) return "warnings";
  return "passed";
}
