import { describe, expect, it } from "vitest";

import { LocalOperationError } from "./api";
import { isLegacyPrepareCompileFailure } from "./legacy-prepare-error";

describe("legacy prepare error classification", () => {
  it.each(["COMPILE_ERROR", "INVALID_TAILWIND"])("treats %s as a compile failure", (code) => {
    expect(isLegacyPrepareCompileFailure(new LocalOperationError(code, "Rejected"))).toBe(true);
  });

  it.each(["VALIDATION_ERROR", "ACCESS_DENIED", "NOT_FOUND", "TRANSACTION_FAILED", "CHALLENGE_EXPIRED"])("keeps %s operational and retryable", (code) => {
    expect(isLegacyPrepareCompileFailure(new LocalOperationError(code, "Unavailable"))).toBe(false);
  });

  it("keeps transport failures operational and retryable", () => {
    expect(isLegacyPrepareCompileFailure(new TypeError("Failed to fetch"))).toBe(false);
  });
});
