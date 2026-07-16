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
