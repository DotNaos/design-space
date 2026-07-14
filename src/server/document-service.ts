import { randomUUID } from "node:crypto";

import {
  documentOperationSchema,
  type DocumentCatalog,
  type DocumentOperation,
  type DocumentOperationResult,
  type DocumentSnapshot,
  type PreparedDocumentCreate,
  type PreparedDocumentSave,
  type ReadyDocumentSave,
  type SavedDocument,
  type SourceVersionMap,
} from "../shared/document-transactions";
import { canonicalJson } from "../shared/canonical-json";
import { designDocumentSchema, type DesignDocument } from "../shared/design-document";
import {
  strictUiStatus,
  type StrictUiViolation,
} from "../shared/strict-ui";
import { commitFileTransaction, type FileTransactionHooks } from "./atomic-file-transaction";
import { ChallengeStore } from "./challenge-store";
import { createUnifiedDiff } from "./diff";
import { registeredFileCatalog } from "./document-catalog-files";
import { createCompileBlocked, createStrictUiEvidence, type StrictUiEvidenceContext } from "./document-service-evidence";
import { validateDependentDocuments, validateTargetStrictUi } from "./document-strict-ui-validation";
import {
  assertDocumentIdentity,
  assertExactSourceSet,
  assertSameVersions,
  digestDocument,
  freezeRecord,
  mergeSourceVersions,
  validateMaterialization,
  versionsFor,
} from "./document-service-values";
import { DesignSpaceError } from "./errors";
import { TrustedDocumentLibrary, type DocumentLibrarySnapshot } from "./document-library";
import { ManagedDocumentCreation } from "./managed-document-creation";
import type { NewFileTransactionHooks } from "./new-file-transaction";
import { readRegisteredFile } from "./registered-file-reader";
import { loadRegisteredDocument } from "./registered-document-loader";
import { sourceVersion } from "./source-editor";
import { TargetTailwindService } from "./target-tailwind-service";
import type {
  DocumentTargetContext,
  RegisteredDocumentTarget,
  RegisteredTarget,
} from "./target-registration";

interface StoredDocumentChallenge {
  id: string;
  documentId: string;
  documentDigest: string;
  previousDocumentDigest: string;
  baseSourceVersions: SourceVersionMap;
  nextSourceVersions: SourceVersionMap;
  nextWriteSources: SourceVersionMap;
  dependencySourceVersions: SourceVersionMap;
  tailwindSourceVersions: SourceVersionMap;
  transactionDigest: string;
  expiresAt: number;
}

export interface DocumentServiceOptions {
  challengeTtlMs?: number;
  now?: () => number;
  createId?: () => string;
  createManagedDocumentId?: () => string;
  managedTransactionHooks?: NewFileTransactionHooks;
  transactionHooks?: FileTransactionHooks;
}

export class DocumentService {
  readonly #target: RegisteredTarget;
  readonly #challenges: ChallengeStore<StoredDocumentChallenge>;
  readonly #challengeTtlMs: number;
  readonly #now: () => number;
  readonly #createId: () => string;
  readonly #transactionHooks: FileTransactionHooks;
  readonly #library: TrustedDocumentLibrary;
  readonly #managedCreation: ManagedDocumentCreation;
  readonly #tailwind: TargetTailwindService;
  readonly #evidenceContext: StrictUiEvidenceContext;
  #saveQueue: Promise<void> = Promise.resolve();

  constructor(target: RegisteredTarget, options: DocumentServiceOptions = {}) {
    this.#target = target;
    this.#challengeTtlMs = options.challengeTtlMs ?? 60_000;
    this.#now = options.now ?? Date.now;
    this.#createId = options.createId ?? randomUUID;
    this.#challenges = new ChallengeStore({ now: this.#now });
    this.#transactionHooks = options.transactionHooks ?? {};
    this.#library = new TrustedDocumentLibrary(target);
    this.#tailwind = new TargetTailwindService(target);
    this.#evidenceContext = {
      createId: this.#createId,
      projectId: target.project.id,
      registrationVersion: target.documentRegistration?.version ?? "unregistered",
    };
    this.#managedCreation = new ManagedDocumentCreation(target, {
      challengeTtlMs: this.#challengeTtlMs,
      now: this.#now,
      createChallengeId: this.#createId,
      createDocumentId: options.createManagedDocumentId,
      transactionHooks: options.managedTransactionHooks,
      library: this.#library,
      tailwind: this.#tailwind,
    });
  }

  async execute(input: unknown): Promise<DocumentOperationResult> {
    const parsed = documentOperationSchema.safeParse(input);
    if (!parsed.success) throw new DesignSpaceError("INVALID_REQUEST", "The document operation is invalid");
    return this.#executeParsed(parsed.data);
  }

  async read(documentId: string): Promise<DocumentSnapshot> {
    const documentTarget = this.#resolve(documentId);
    const sources = await this.#readSources(documentTarget);
    const sourceVersions = versionsFor(sources);
    let document: DesignDocument;
    try {
      document = await loadRegisteredDocument(documentTarget, sources, this.#context(documentTarget, sources));
    } catch (error) {
      await this.#assertSourcesUnchanged(documentTarget, sourceVersions);
      throw error;
    }
    const versionsAfterLoad = await this.#readSourceVersions(documentTarget);
    assertSameVersions(sourceVersions, versionsAfterLoad);
    return {
      documentId,
      document,
      documentDigest: digestDocument(document),
      sourceVersions,
    };
  }

  async list(): Promise<DocumentCatalog> {
    const documents = await Promise.all(
      [...(this.#target.documentRegistration?.documents.values() ?? [])].map(async (target) => {
        const snapshot = await this.read(target.id);
        return {
          id: snapshot.document.id,
          label: snapshot.document.label,
          kind: snapshot.document.kind,
          group: snapshot.document.component?.group,
          origin: target.origin,
        };
      }),
    );
    return {
      state: "catalog",
      documents: documents.sort((left, right) =>
        left.kind.localeCompare(right.kind, "en") || left.label.localeCompare(right.label, "en") || left.id.localeCompare(right.id, "en")),
      recipes: this.#managedCreation.recipes(),
      files: registeredFileCatalog(this.#target),
    };
  }

  prepareCreate(recipeId: string, label: string): Promise<PreparedDocumentCreate> {
    return this.#managedCreation.prepare(recipeId, label);
  }

  async prepare(
    documentId: string,
    document: DesignDocument,
    baseDocumentDigest: string,
    baseSourceVersions: SourceVersionMap,
  ): Promise<PreparedDocumentSave> {
    const documentTarget = this.#resolve(documentId);
    const parsedDocument = designDocumentSchema.safeParse(document);
    if (!parsedDocument.success) {
      throw new DesignSpaceError("INVALID_REQUEST", "The proposed document is invalid");
    }
    document = parsedDocument.data;
    assertDocumentIdentity(documentId, document);
    assertExactSourceSet(documentTarget, baseSourceVersions);

    const sources = await this.#readSources(documentTarget);
    const currentSourceVersions = versionsFor(sources);
    assertSameVersions(baseSourceVersions, currentSourceVersions);
    let currentDocument: DesignDocument;
    try {
      currentDocument = await loadRegisteredDocument(documentTarget, sources, this.#context(documentTarget, sources));
    } catch (error) {
      await this.#assertSourcesUnchanged(documentTarget, currentSourceVersions);
      throw error;
    }
    await this.#assertSourcesUnchanged(documentTarget, currentSourceVersions);
    if (digestDocument(currentDocument) !== baseDocumentDigest) {
      throw new DesignSpaceError("STALE_SOURCE", "The document changed after the editor loaded it");
    }
    if (document.kind !== currentDocument.kind) {
      throw new DesignSpaceError("INVALID_REQUEST", "The document kind cannot be changed after creation");
    }
    const library = await this.#library.capture(documentId, sources);

    const documentDigest = digestDocument(document);
    const checkedAt = new Date(this.#now()).toISOString();
    let violations: readonly StrictUiViolation[];
    try {
      violations = await validateTargetStrictUi(
        documentTarget,
        document,
        this.#context(documentTarget, sources, library.documents),
      );
      if (document.kind === "component") {
        violations = [
          ...violations,
          ...await validateDependentDocuments(currentDocument, document, library, this.#library),
        ];
      }
    } catch (error) {
      await this.#assertValidationInputsUnchanged(documentTarget, currentSourceVersions, library);
      throw error;
    }
    await this.#assertValidationInputsUnchanged(documentTarget, currentSourceVersions, library);
    const validationSourceVersions = mergeSourceVersions(currentSourceVersions, library.sourceVersions);
    if (strictUiStatus(violations) === "blocked") {
      return {
        state: "strict-blocked",
        documentId,
        documentDigest,
        strictUi: createStrictUiEvidence({
          ...this.#evidenceContext,
          documentId,
          documentDigest,
          sourceVersions: validationSourceVersions,
          violations,
          checkedAt,
        }),
      };
    }

    let tailwindSourceVersions: SourceVersionMap = freezeRecord({});
    try {
      const tailwind = await this.#tailwind.compileDocument(
        document,
        this.#context(documentTarget, sources, library.documents),
      );
      tailwindSourceVersions = freezeRecord(tailwind.sourceVersions);
    } catch (error) {
      await this.#assertValidationInputsUnchanged(documentTarget, currentSourceVersions, library);
      if (error instanceof DesignSpaceError && !["INVALID_TAILWIND", "COMPILE_ERROR"].includes(error.code)) {
        throw error;
      }
      return createCompileBlocked({
        ...this.#evidenceContext,
        documentId,
        documentDigest,
        sourceVersions: validationSourceVersions,
        violations,
        checkedAt,
        message: "The target rejected this document's Tailwind classes",
        now: this.#now,
      });
    }
    await this.#assertValidationInputsUnchanged(documentTarget, currentSourceVersions, library);
    await this.#tailwind.assertUnchanged(tailwindSourceVersions);
    const compiledValidationVersions = mergeSourceVersions(
      currentSourceVersions,
      library.sourceVersions,
      tailwindSourceVersions,
    );

    let materialized: Readonly<Record<string, string>>;
    try {
      materialized = await documentTarget.materialize(
        structuredClone(document),
        this.#context(documentTarget, sources, library.documents),
      );
    } catch {
      await this.#assertValidationInputsUnchanged(documentTarget, currentSourceVersions, library);
      await this.#tailwind.assertUnchanged(tailwindSourceVersions);
      return createCompileBlocked({
        ...this.#evidenceContext,
        documentId,
        documentDigest,
        sourceVersions: compiledValidationVersions,
        violations,
        checkedAt,
        message: "The target could not materialize this document",
        now: this.#now,
      });
    }
    await this.#assertValidationInputsUnchanged(documentTarget, currentSourceVersions, library);
    await this.#tailwind.assertUnchanged(tailwindSourceVersions);
    const nextWriteSources = validateMaterialization(documentTarget, materialized);
    const nextSources = freezeRecord({ ...sources, ...nextWriteSources });
    const nextSourceVersions = versionsFor(nextSources);
    let reloadedDocument: DesignDocument;
    try {
      reloadedDocument = await loadRegisteredDocument(documentTarget, nextSources, this.#context(documentTarget, nextSources));
    } catch (error) {
      await this.#assertValidationInputsUnchanged(documentTarget, currentSourceVersions, library);
      await this.#tailwind.assertUnchanged(tailwindSourceVersions);
      throw error;
    }
    await this.#assertValidationInputsUnchanged(documentTarget, currentSourceVersions, library);
    await this.#tailwind.assertUnchanged(tailwindSourceVersions);
    if (digestDocument(reloadedDocument) !== documentDigest) {
      throw new DesignSpaceError("INVALID_REGISTRATION", "The target materialization did not preserve the document");
    }
    const strictUi = createStrictUiEvidence({
      ...this.#evidenceContext,
      documentId,
      documentDigest,
      sourceVersions: mergeSourceVersions(nextSourceVersions, library.sourceVersions, tailwindSourceVersions),
      violations,
      checkedAt,
    });

    try {
      await documentTarget.compile?.(nextSources, this.#context(documentTarget, nextSources, library.documents));
    } catch {
      await this.#assertValidationInputsUnchanged(documentTarget, currentSourceVersions, library);
      await this.#tailwind.assertUnchanged(tailwindSourceVersions);
      return {
        state: "compile-blocked",
        documentId,
        documentDigest,
        strictUi,
        compile: { status: "failed", checkedAt: new Date(this.#now()).toISOString(), message: "The target did not compile" },
      };
    }
    await this.#assertValidationInputsUnchanged(documentTarget, currentSourceVersions, library);
    await this.#tailwind.assertUnchanged(tailwindSourceVersions);

    const changes = documentTarget.writeFileIds
      .filter((fileId) => sources[fileId] !== nextWriteSources[fileId])
      .sort((left, right) => left.localeCompare(right, "en"))
      .map((fileId) => {
        const file = this.#target.files.get(fileId)!;
        return {
          fileId,
          label: file.displayName,
          beforeVersion: currentSourceVersions[fileId],
          nextVersion: nextSourceVersions[fileId],
        };
      });
    const diff = changes
      .map((change) => createUnifiedDiff(sources[change.fileId], nextWriteSources[change.fileId], change.label))
      .join("\n");
    const transactionDigest = sourceVersion(canonicalJson({
      baseSourceVersions: currentSourceVersions,
      changes,
      documentDigest,
      documentId,
      nextSourceVersions,
      dependencySourceVersions: library.sourceVersions,
      tailwindSourceVersions,
      registrationVersion: this.#registrationVersion(),
    }));
    const challengeId = this.#createId();
    const expiresAt = this.#now() + this.#challengeTtlMs;
    this.#challenges.set(challengeId, {
      id: challengeId,
      documentId,
      documentDigest,
      previousDocumentDigest: baseDocumentDigest,
      baseSourceVersions: currentSourceVersions,
      nextSourceVersions,
      nextWriteSources,
      dependencySourceVersions: library.sourceVersions,
      tailwindSourceVersions,
      transactionDigest,
      expiresAt,
    });
    return {
      state: "ready",
      challengeId,
      documentId,
      documentDigest,
      baseSourceVersions: currentSourceVersions,
      nextSourceVersions,
      changes,
      diff,
      strictUi,
      compile: { status: "passed", checkedAt: new Date(this.#now()).toISOString() },
      transactionDigest,
      expiresAt: new Date(expiresAt).toISOString(),
    } satisfies ReadyDocumentSave;
  }

  save(challengeId: string): Promise<SavedDocument> {
    const pending = this.#saveQueue.then(() => this.#saveNow(challengeId));
    this.#saveQueue = pending.then(() => undefined, () => undefined);
    return pending;
  }

  async #executeParsed(operation: DocumentOperation): Promise<DocumentOperationResult> {
    switch (operation.type) {
      case "list-documents":
        return this.list();
      case "read-document":
        return this.read(operation.documentId);
      case "prepare-document-create":
        return this.prepareCreate(operation.recipeId, operation.label);
      case "prepare-document-save":
        return this.prepare(
          operation.documentId,
          operation.document,
          operation.baseDocumentDigest,
          operation.baseSourceVersions,
        );
      case "save-document":
        return this.save(operation.challengeId);
    }
  }

  async #saveNow(challengeId: string): Promise<SavedDocument> {
    if (this.#managedCreation.hasChallenge(challengeId)) return this.#managedCreation.save(challengeId);
    const challenge = this.#challenges.take(challengeId);
    if (!challenge) throw new DesignSpaceError("NOT_FOUND", "The prepared document save does not exist");
    if (challenge.expiresAt <= this.#now()) {
      throw new DesignSpaceError("CHALLENGE_EXPIRED", "The prepared document save expired before it was used");
    }
    const documentTarget = this.#resolve(challenge.documentId);
    await this.#assertSourcesUnchanged(documentTarget, challenge.baseSourceVersions);
    await this.#library.assertUnchanged(challenge.dependencySourceVersions);
    await this.#tailwind.assertUnchanged(challenge.tailwindSourceVersions);
    const changes = documentTarget.writeFileIds
      .filter((fileId) => challenge.baseSourceVersions[fileId] !== challenge.nextSourceVersions[fileId])
      .map((fileId) => ({
        file: this.#target.files.get(fileId)!,
        expectedVersion: challenge.baseSourceVersions[fileId],
        nextSource: challenge.nextWriteSources[fileId],
      }));
    await commitFileTransaction(this.#target.root, changes, {
      ...this.#transactionHooks,
      beforeInstall: async () => {
        await this.#assertSourcesUnchanged(documentTarget, challenge.baseSourceVersions);
        await this.#library.assertUnchanged(challenge.dependencySourceVersions);
        await this.#tailwind.assertUnchanged(challenge.tailwindSourceVersions);
        await this.#transactionHooks.beforeInstall?.();
      },
    });
    const sourceVersions = await this.#readSourceVersions(documentTarget);
    assertSameVersions(challenge.nextSourceVersions, sourceVersions);
    return {
      state: "saved",
      documentId: challenge.documentId,
      documentDigest: challenge.documentDigest,
      previousDocumentDigest: challenge.previousDocumentDigest,
      sourceVersions,
      transactionDigest: challenge.transactionDigest,
    };
  }

  #resolve(documentId: string): RegisteredDocumentTarget {
    const document = this.#target.documentRegistration?.documents.get(documentId);
    if (!document) throw new DesignSpaceError("NOT_FOUND", "The document is not registered");
    return document;
  }

  #registrationVersion(): string {
    return this.#target.documentRegistration?.version ?? "unregistered";
  }

  #context(
    document: RegisteredDocumentTarget,
    sources: Readonly<Record<string, string>>,
    libraryDocuments: readonly DesignDocument[] = [],
  ): DocumentTargetContext {
    return this.#library.context(document.id, sources, libraryDocuments);
  }

  async #readSources(document: RegisteredDocumentTarget): Promise<Readonly<Record<string, string>>> {
    const entries: Array<[string, string]> = [];
    for (const fileId of [...document.sourceFileIds].sort((left, right) => left.localeCompare(right, "en"))) {
      const file = this.#target.files.get(fileId)!;
      entries.push([fileId, await readRegisteredFile(this.#target.root, file.path)]);
    }
    return freezeRecord(Object.fromEntries(entries));
  }

  async #readSourceVersions(document: RegisteredDocumentTarget): Promise<SourceVersionMap> {
    return versionsFor(await this.#readSources(document));
  }

  async #assertSourcesUnchanged(document: RegisteredDocumentTarget, expected: SourceVersionMap): Promise<void> {
    assertSameVersions(expected, await this.#readSourceVersions(document));
  }

  async #assertValidationInputsUnchanged(
    document: RegisteredDocumentTarget,
    sourceVersions: SourceVersionMap,
    library: DocumentLibrarySnapshot,
  ): Promise<void> {
    await this.#assertSourcesUnchanged(document, sourceVersions);
    await this.#library.assertUnchanged(library.sourceVersions);
  }

}
