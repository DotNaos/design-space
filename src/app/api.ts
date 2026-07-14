import type {
  BrowserOperation,
  PreparedEdit,
  ProjectFileSnapshot,
  SavedEdit,
  SourceSnapshot,
  TailwindPreview,
} from "../shared/contracts";
import type { DocumentOperation, DocumentOperationResult } from "../shared/document-transactions";

type LocalOperation = BrowserOperation | DocumentOperation;
type OperationResult = SourceSnapshot | ProjectFileSnapshot | PreparedEdit | SavedEdit | TailwindPreview | DocumentOperationResult;

export class LocalOperationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: Readonly<Record<string, string>>,
  ) {
    super(message);
    this.name = "LocalOperationError";
  }
}

export async function runLocalOperation<T extends OperationResult>(operation: LocalOperation): Promise<T> {
  const response = await fetch("/__design-space/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(operation),
  });
  const payload = await response.json() as {
    ok: boolean;
    data?: T;
    error?: { code: string; message: string; details?: Readonly<Record<string, string>> };
  };
  if (!response.ok || !payload.ok || !payload.data) {
    throw new LocalOperationError(
      payload.error?.code ?? "LOCAL_RUNTIME_ERROR",
      payload.error?.message ?? "The local Design Space runtime did not respond.",
      payload.error?.details,
    );
  }
  return payload.data;
}
