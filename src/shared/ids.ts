import { z } from "zod";

export const opaqueIdSchema = z
  .string()
  .min(1)
  .max(96)
  .regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/i, "Expected an opaque identifier");

export const sourceVersionSchema = z.string().regex(/^[a-f0-9]{64}$/);
