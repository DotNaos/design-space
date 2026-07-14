import { browserOperationSchema } from "../shared/contracts";
import { documentOperationSchema } from "../shared/document-transactions";
import { DesignSpaceError } from "./errors";
import type { DocumentService } from "./document-service";
import type { EditService } from "./edit-service";

export interface OperationExecutor {
  execute(input: unknown): Promise<unknown>;
}

export class LocalOperationService implements OperationExecutor {
  readonly #editService: EditService;
  readonly #documentService: DocumentService;

  constructor(editService: EditService, documentService: DocumentService) {
    this.#editService = editService;
    this.#documentService = documentService;
  }

  async execute(input: unknown): Promise<unknown> {
    if (documentOperationSchema.safeParse(input).success) return this.#documentService.execute(input);
    if (browserOperationSchema.safeParse(input).success) return this.#editService.execute(input);
    throw new DesignSpaceError("INVALID_REQUEST", "The local operation is invalid");
  }
}
