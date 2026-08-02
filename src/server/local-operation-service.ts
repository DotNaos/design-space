import { browserOperationSchema, libraryDevelopmentOperationSchema, sourceApprovalOperationSchema } from "../shared/contracts";
import { documentOperationSchema } from "../shared/document-transactions";
import { DesignSpaceError } from "./errors";
import type { DocumentService } from "./document-service";
import type { EditService } from "./edit-service";
import type { ViteDevServer } from "vite";

export interface OperationExecutor {
  execute(input: unknown): Promise<unknown>;
  attachServer?(server: ViteDevServer): void;
  dispose?(): void;
}

export class LocalOperationService implements OperationExecutor {
  readonly #editService: EditService;
  readonly #documentService: DocumentService;
  readonly #libraryDevelopmentService?: OperationExecutor;
  readonly #sourceApprovalService?: OperationExecutor;
  #disposed = false;

  constructor(
    editService: EditService,
    documentService: DocumentService,
    libraryDevelopmentService?: OperationExecutor,
    sourceApprovalService?: OperationExecutor,
  ) {
    this.#editService = editService;
    this.#documentService = documentService;
    this.#libraryDevelopmentService = libraryDevelopmentService;
    this.#sourceApprovalService = sourceApprovalService;
  }

  async execute(input: unknown): Promise<unknown> {
    if (this.#disposed) throw new DesignSpaceError("VALIDATION_ERROR", "The local operation service has shut down");
    if (libraryDevelopmentOperationSchema.safeParse(input).success) {
      if (!this.#libraryDevelopmentService) {
        throw new DesignSpaceError("ACCESS_DENIED", "Library development is not configured for this project");
      }
      return this.#libraryDevelopmentService.execute(input);
    }
    if (documentOperationSchema.safeParse(input).success) return this.#documentService.execute(input);
    if (sourceApprovalOperationSchema.safeParse(input).success) {
      if (!this.#sourceApprovalService) {
        throw new DesignSpaceError("ACCESS_DENIED", "Component signing is not configured for this project");
      }
      return this.#sourceApprovalService.execute(input);
    }
    if (browserOperationSchema.safeParse(input).success) return this.#editService.execute(input);
    throw new DesignSpaceError("INVALID_REQUEST", "The local operation is invalid");
  }

  attachServer(server: ViteDevServer): void {
    this.#libraryDevelopmentService?.attachServer?.(server);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#editService.dispose();
    this.#libraryDevelopmentService?.dispose?.();
  }
}
