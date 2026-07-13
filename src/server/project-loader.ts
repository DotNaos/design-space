import { resolve } from "node:path";

import { runnerImport } from "vite";

import { DesignSpaceError } from "./errors";
import { canonicalRegisteredFile, canonicalRoot } from "./path-security";
import { registerTrustedTarget, type RegisteredTarget, type TrustedTargetConfig } from "./target-registration";

export const TARGET_REGISTRATION_FILE = "design-space.server.ts";

export interface TargetRegistrationModule {
  registration: Omit<TrustedTargetConfig, "root">;
}

export async function loadRegisteredProject(projectRoot: string): Promise<RegisteredTarget> {
  const root = await canonicalRoot(projectRoot);
  const registrationPath = await canonicalRegisteredFile(root, TARGET_REGISTRATION_FILE);
  const { module } = await runnerImport<Partial<TargetRegistrationModule>>(registrationPath, {
    root,
    logLevel: "silent",
  });
  if (!module.registration || typeof module.registration !== "object") {
    throw new DesignSpaceError("INVALID_REGISTRATION", `${TARGET_REGISTRATION_FILE} must export registration`);
  }
  const registered = await registerTrustedTarget({ ...module.registration, root } as TrustedTargetConfig);
  return { ...registered, registrationPath };
}

export function resolveServerProjectRoot(fallbackRoot: string): string {
  const configuredRoot = process.env.DESIGN_SPACE_PROJECT_ROOT;
  return resolve(configuredRoot || fallbackRoot);
}
