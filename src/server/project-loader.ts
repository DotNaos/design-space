import { lstat } from "node:fs/promises";
import { resolve } from "node:path";

import { runnerImport } from "vite";

import { DesignSpaceError } from "./errors";
import { canonicalRegisteredFile, canonicalRoot } from "./path-security";
import { registerTrustedTarget, type RegisteredTarget, type TrustedTargetConfig } from "./target-registration";
import { parseSourceProjectConfig } from "./source-project-config";
import { registerSourceProject } from "./source-project-registration";

export const DESIGN_SPACE_CONFIG_FILE = ".designspace.ts";
export const TARGET_REGISTRATION_FILE = "design-space.server.ts";

export interface TargetRegistrationModule {
  registration: Omit<TrustedTargetConfig, "root">;
}

export async function loadRegisteredProject(projectRoot: string): Promise<RegisteredTarget> {
  const root = await canonicalRoot(projectRoot);
  if (await isFile(resolve(root, DESIGN_SPACE_CONFIG_FILE))) {
    const configPath = await canonicalRegisteredFile(root, DESIGN_SPACE_CONFIG_FILE);
    const { module } = await runnerImport<Record<string, unknown>>(configPath, {
      root,
      logLevel: "silent",
    });
    const config = parseSourceProjectConfig(module.default ?? module.designSpace);
    return registerSourceProject(root, config);
  }

  if (!await isFile(resolve(root, TARGET_REGISTRATION_FILE))) {
    throw new DesignSpaceError(
      "INVALID_REGISTRATION",
      `The project root must contain ${DESIGN_SPACE_CONFIG_FILE}`,
    );
  }
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

async function isFile(path: string): Promise<boolean> {
  const metadata = await lstat(path).catch(() => undefined);
  return Boolean(metadata?.isFile() && !metadata.isSymbolicLink());
}

export function resolveServerProjectRoot(fallbackRoot: string): string {
  const configuredRoot = process.env.DESIGN_SPACE_PROJECT_ROOT;
  return resolve(configuredRoot || fallbackRoot);
}
