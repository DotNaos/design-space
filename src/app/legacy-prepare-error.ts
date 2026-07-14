import { LocalOperationError } from "./api";

const compileFailureCodes = new Set(["COMPILE_ERROR", "INVALID_TAILWIND"]);

export function isLegacyPrepareCompileFailure(error: unknown): boolean {
  return error instanceof LocalOperationError && compileFailureCodes.has(error.code);
}
