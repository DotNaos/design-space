import { z } from "zod";

import { opaqueIdSchema } from "../shared/ids";
import type { DesignSpaceProjectConfig } from "../shared/source-workspace";
import { DesignSpaceError } from "./errors";

const sourceProjectConfigSchema = z.object({
  project: z.object({
    id: opaqueIdSchema,
    label: z.string().trim().min(1).max(120),
  }).strict(),
  runtime: z.enum(["react", "react-native"]).optional(),
  tablet: z.object({ fallback: z.enum(["desktop", "mobile"]) }).strict().optional(),
  devices: z.object({ mode: z.literal("responsive") }).strict().optional(),
  source: z.object({
    layout: z.string().regex(/^src\/(?!.*(?:^|\/)\.\.(?:\/|$))[^\\]+\.tsx$/),
  }).strict().optional(),
  library: z.object({
    package: z.string().regex(/^@?[a-z0-9][a-z0-9._/-]*$/i).max(160),
    project: z.object({
      repository: z.string().url().regex(/^https:\/\/github\.com\/[^/\s]+\/[^/\s]+(?:\.git)?$/i).max(500),
      checkoutName: z.string().regex(/^[a-z0-9][a-z0-9._-]*$/i).max(120),
      packageRoot: z.string()
        .regex(/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[^\\]+$/)
        .max(1_024),
    }).strict().optional(),
    development: z.object({
      root: z.string().min(1).max(1_024),
    }).strict().optional(),
  }).strict().optional(),
  approvals: z.object({
    policy: z.string()
      .regex(/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[^\\]+\.ya?ml$/)
      .max(1_024)
      .optional(),
  }).strict().optional(),
}).strict();

export function parseSourceProjectConfig(value: unknown): DesignSpaceProjectConfig {
  const parsed = sourceProjectConfigSchema.safeParse(value);
  if (!parsed.success) {
    throw new DesignSpaceError(
      "INVALID_REGISTRATION",
      ".designspace.ts must export a valid Design Space project config",
    );
  }
  return parsed.data;
}
