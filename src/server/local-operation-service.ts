import { browserOperationSchema, libraryRuntimeOperationSchema } from "../shared/contracts";
import { documentOperationSchema } from "../shared/document-transactions";
import { DesignSpaceError } from "./errors";
import type { DocumentService } from "./document-service";
import type { EditService } from "./edit-service";
import type { LibraryRuntimeService } from "./library-runtime-service";

export interface OperationExecutor {
  execute(input: unknown): Promise<unknown>;
  dispose?(): void;
}

export class LocalOperationService implements OperationExecutor {
  readonly #editService: EditService;
  readonly #documentService: DocumentService;
  readonly #libraryRuntime?: LibraryRuntimeService;
  #disposed = false;

  constructor(editService: EditService, documentService: DocumentService, libraryRuntime?: LibraryRuntimeService) {
    this.#editService = editService;
    this.#documentService = documentService;
    this.#libraryRuntime = libraryRuntime;
  }

  async execute(input: unknown): Promise<unknown> {
    if (this.#disposed) throw new DesignSpaceError("VALIDATION_ERROR", "The local operation service has shut down");
    if (documentOperationSchema.safeParse(input).success) return this.#documentService.execute(input);
    const libraryOperation = libraryRuntimeOperationSchema.safeParse(input);
    if (libraryOperation.success) {
      if (!this.#libraryRuntime) throw new DesignSpaceError("INVALID_REGISTRATION", "No component library runtime is registered");
      return this.#libraryRuntime.execute(libraryOperation.data);
    }
    if (browserOperationSchema.safeParse(input).success) return this.#editService.execute(input);
    throw new DesignSpaceError("INVALID_REQUEST", "The local operation is invalid");
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#editService.dispose();
    this.#libraryRuntime?.dispose();
  }
}
