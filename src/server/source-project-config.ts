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
    development: z.object({
      root: z.string().min(1).max(1_024),
      command: z.tuple([z.string().min(1).max(200)]).rest(z.string().min(1).max(500)).refine((command) => command.length <= 16),
      portlessName: z.string().regex(/^[a-z0-9][a-z0-9.-]{0,79}$/),
    }).strict().optional(),
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
