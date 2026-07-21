import type {
  BrowserOperation,
  GeneratedSourceDesign,
  PreparedEdit,
  PreparedProjectFileEdit,
  PreparedSourceComponentCreate,
  ProjectFileSnapshot,
  SavedEdit,
  SavedProjectFileEdit,
  SavedSourceComponentCreate,
  SourceDraftAnalysis,
  SourceSnapshot,
  TailwindIntelligence,
  TailwindPreview,
} from "../shared/contracts";
import type { DocumentOperation, DocumentOperationResult } from "../shared/document-transactions";

type LocalOperation = BrowserOperation | DocumentOperation;
type OperationResult = SourceSnapshot | ProjectFileSnapshot | SourceDraftAnalysis | PreparedEdit | PreparedProjectFileEdit | PreparedSourceComponentCreate | SavedEdit | SavedProjectFileEdit | SavedSourceComponentCreate | GeneratedSourceDesign | TailwindPreview | TailwindIntelligence | DocumentOperationResult;

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

const unavailableMessage = "The local Design Space server is unavailable. Restart the dev server and try again.";

type LocalOperationPayload<T> = {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; details?: Readonly<Record<string, string>> };
};

function unavailableError(response?: Response): LocalOperationError {
  const details = response ? { status: String(response.status) } : undefined;
  return new LocalOperationError("LOCAL_RUNTIME_UNAVAILABLE", unavailableMessage, details);
}

export async function runLocalOperation<T extends OperationResult>(operation: LocalOperation): Promise<T> {
  let response: Response;
  try {
    response = await fetch("/__design-space/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(operation),
    });
  } catch {
    throw unavailableError();
  }

  const body = await response.text();
  let payload: LocalOperationPayload<T>;
  try {
    payload = JSON.parse(body) as LocalOperationPayload<T>;
  } catch {
    throw unavailableError(response);
  }

  if (!response.ok || !payload.ok || !payload.data) {
    throw new LocalOperationError(
      payload.error?.code ?? "LOCAL_RUNTIME_ERROR",
      payload.error?.message ?? "The local Design Space runtime did not respond.",
      payload.error?.details,
    );
  }
  return payload.data;
}
