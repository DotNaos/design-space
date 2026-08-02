import type {
  AppliedSourceChangeSet,
  BrowserOperation,
  GeneratedSourceDesign,
  LibraryDevelopmentOperation,
  PreparedEdit,
  PreparedProjectFileEdit,
  PreparedSourceChangeSet,
  PreparedSourceComponentCreate,
  ProjectFileSnapshot,
  SavedEdit,
  SavedProjectFileEdit,
  SavedSourceComponentCreate,
  SignedSourceComponent,
  SourceApprovalOperation,
  SourceDraftAnalysis,
  SourceSnapshot,
  TailwindIntelligence,
  TailwindPreview,
} from "../shared/contracts";
import type { DocumentOperation, DocumentOperationResult } from "../shared/document-transactions";
import type { LibraryDevelopmentProjectStatus } from "../shared/source-workspace";

type LocalOperation = BrowserOperation | DocumentOperation | LibraryDevelopmentOperation | SourceApprovalOperation;
type OperationResult = SourceSnapshot | ProjectFileSnapshot | SourceDraftAnalysis | PreparedEdit | PreparedProjectFileEdit | PreparedSourceChangeSet | PreparedSourceComponentCreate | SavedEdit | SavedProjectFileEdit | AppliedSourceChangeSet | SavedSourceComponentCreate | GeneratedSourceDesign | SignedSourceComponent | TailwindPreview | TailwindIntelligence | DocumentOperationResult | LibraryDevelopmentProjectStatus;

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
