export type DesignSpaceErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_REGISTRATION"
  | "ACCESS_DENIED"
  | "NOT_FOUND"
  | "INVALID_ADAPTER"
  | "INVALID_DOCUMENT"
  | "INVALID_TAILWIND"
  | "VALIDATION_ERROR"
  | "COMPILE_ERROR"
  | "STALE_SOURCE"
  | "CHALLENGE_EXPIRED"
  | "TRANSACTION_FAILED";

export class DesignSpaceError extends Error {
  readonly code: DesignSpaceErrorCode;
  readonly details?: Readonly<Record<string, string>>;

  constructor(
    code: DesignSpaceErrorCode,
    message: string,
    details?: Readonly<Record<string, string>>,
  ) {
    super(message);
    this.name = "DesignSpaceError";
    this.code = code;
    this.details = details;
  }
}

export function asDesignSpaceError(error: unknown): DesignSpaceError {
  if (error instanceof DesignSpaceError) return error;
  return new DesignSpaceError("VALIDATION_ERROR", "The edit could not be validated");
}
