import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import { z } from "zod";

import { canonicalJson } from "../shared/canonical-json";
import { designDocumentSchema, type DesignDocument } from "../shared/design-document";
import type {
  CompileBlockedDocumentSave,
  DocumentCreationRecipeEntry,
  PreparedDocumentCreate,
  ReadyDocumentCreate,
  SavedDocument,
  SourceVersionMap,
} from "../shared/document-transactions";
import {
  strictUiEvidenceSchema,
  strictUiStatus,
  strictUiViolationSchema,
  type StrictUiEvidence,
  type StrictUiViolation,
} from "../shared/strict-ui";
import { createNewFileDiff } from "./diff";
import { ChallengeStore } from "./challenge-store";
import { digestDocument, freezeRecord, sourceSetVersion, versionsFor } from "./document-service-values";
import { TrustedDocumentLibrary } from "./document-library";
import { DesignSpaceError } from "./errors";
import {
  assertManagedDirectoryIdentity,
  createManagedDocumentEntry,
  installManagedDocumentEntry,
  managedRecipeContext,
  type ManagedDocumentEntry,
} from "./managed-document-registration";
import { commitNewManagedFile, type NewFileTransactionHooks } from "./new-file-transaction";
import { sourceVersion } from "./source-editor";
import { TargetTailwindService } from "./target-tailwind-service";
import type { DocumentTargetContext, RegisteredTarget } from "./target-registration";

const maximumDocumentCount = 500;

interface StoredCreationChallenge {
  document: DesignDocument;
  documentDigest: string;
  entry: ManagedDocumentEntry;
  expiresAt: number;
  nextSource: string;
  nextSourceVersions: SourceVersionMap;
  dependencySourceVersions: SourceVersionMap;
  tailwindSourceVersions: SourceVersionMap;
  transactionDigest: string;
}

export interface ManagedDocumentCreationOptions {
  challengeTtlMs: number;
  now: () => number;
  createChallengeId: () => string;
  createDocumentId?: () => string;
  transactionHooks?: NewFileTransactionHooks;
  library: TrustedDocumentLibrary;
  tailwind: TargetTailwindService;
}

export class ManagedDocumentCreation {
  readonly #target: RegisteredTarget;
  readonly #options: ManagedDocumentCreationOptions;
  readonly #challenges: ChallengeStore<StoredCreationChallenge>;

  constructor(target: RegisteredTarget, options: ManagedDocumentCreationOptions) {
    this.#target = target;
    this.#options = options;
    this.#challenges = new ChallengeStore({ now: options.now });
  }

  recipes(): readonly DocumentCreationRecipeEntry[] {
    return [...(this.#store()?.recipes.values() ?? [])]
      .map(({ id, label, description, kind }) => ({ id, label, description, kind }))
      .sort((left, right) => left.label.localeCompare(right.label, "en") || left.id.localeCompare(right.id, "en"));
  }

  hasChallenge(challengeId: string): boolean {
    return this.#challenges.has(challengeId);
  }

  async prepare(recipeId: string, label: string): Promise<PreparedDocumentCreate> {
    this.#assertCapacity();
    const store = this.#store();
    const recipe = store?.recipes.get(recipeId);
    if (!store || !recipe) throw new DesignSpaceError("NOT_FOUND", "The managed document recipe is not registered");
    await assertManagedDirectoryIdentity(this.#target.root, store);

    const uuid = z.string().uuid().parse((this.#options.createDocumentId ?? randomUUID)()).toLowerCase();
    const documentId = `${recipe.kind}.${uuid}`;
    let created: unknown;
    try {
      created = await recipe.create(
        Object.freeze({ documentId, label }),
        managedRecipeContext(this.#target.project.id, this.#registrationVersion(), documentId, recipeId),
      );
    } catch {
      throw new DesignSpaceError("INVALID_REGISTRATION", "The managed document recipe could not create a document");
    }
    const parsed = designDocumentSchema.safeParse(created);
    if (!parsed.success || parsed.data.id !== documentId || parsed.data.kind !== recipe.kind || parsed.data.label !== label) {
      throw new DesignSpaceError("INVALID_REGISTRATION", "The managed document recipe returned an invalid document");
    }

    const document = parsed.data;
    const entry = createManagedDocumentEntry(this.#target.root, store, document);
    if (this.#target.files.has(entry.file.id) || this.#documents().has(entry.target.id)) {
      throw new DesignSpaceError("STALE_SOURCE", "The generated managed document identity is already registered");
    }
    const nextSource = `${canonicalJson(document, 2)}\n`;
    const sources = Object.freeze({ [entry.file.id]: nextSource });
    const nextSourceVersions = versionsFor(sources);
    const library = await this.#options.library.capture(documentId, sources);
    const documentDigest = digestDocument(document);
    const checkedAt = new Date(this.#options.now()).toISOString();
    let violations: readonly StrictUiViolation[];
    try {
      violations = await this.#strictUi(document, this.#context(entry.target.id, sources, library.documents));
    } catch (error) {
      await this.#options.library.assertUnchanged(library.sourceVersions);
      throw error;
    }
    await this.#options.library.assertUnchanged(library.sourceVersions);
    const validationVersions = freezeRecord({ ...library.sourceVersions, ...nextSourceVersions });
    const strictEvidence = this.#evidence(document.id, documentDigest, validationVersions, violations, checkedAt);
    if (strictUiStatus(violations) === "blocked") {
      return { state: "strict-blocked", documentId, documentDigest, strictUi: strictEvidence };
    }

    let tailwindSourceVersions: SourceVersionMap = freezeRecord({});
    try {
      const tailwind = await this.#options.tailwind.compileDocument(
        document,
        this.#context(entry.target.id, sources, library.documents),
      );
      tailwindSourceVersions = freezeRecord(tailwind.sourceVersions);
    } catch (error) {
      await this.#options.library.assertUnchanged(library.sourceVersions);
      if (error instanceof DesignSpaceError && !["INVALID_TAILWIND", "COMPILE_ERROR"].includes(error.code)) {
        throw error;
      }
      return this.#compileBlocked(documentId, documentDigest, strictEvidence, "The target rejected this document's Tailwind classes");
    }
    await this.#options.library.assertUnchanged(library.sourceVersions);
    await this.#options.tailwind.assertUnchanged(tailwindSourceVersions);
    const evidence = this.#evidence(
      document.id,
      documentDigest,
      freezeRecord({ ...library.sourceVersions, ...tailwindSourceVersions, ...nextSourceVersions }),
      violations,
      checkedAt,
    );

    try {
      await store.compile?.(sources, this.#context(entry.target.id, sources, library.documents));
    } catch {
      await this.#options.library.assertUnchanged(library.sourceVersions);
      await this.#options.tailwind.assertUnchanged(tailwindSourceVersions);
      return this.#compileBlocked(documentId, documentDigest, evidence);
    }
    await this.#options.library.assertUnchanged(library.sourceVersions);
    await this.#options.tailwind.assertUnchanged(tailwindSourceVersions);
    await assertManagedDirectoryIdentity(this.#target.root, store);

    const challengeId = z.string().uuid().parse(this.#options.createChallengeId());
    const expiresAt = this.#options.now() + this.#options.challengeTtlMs;
    const transactionDigest = sourceVersion(canonicalJson({
      documentDigest,
      documentId,
      nextSourceVersions,
      dependencySourceVersions: library.sourceVersions,
      tailwindSourceVersions,
      recipeId,
      registrationVersion: this.#registrationVersion(),
    }));
    this.#challenges.set(challengeId, {
      document,
      documentDigest,
      entry,
      expiresAt,
      nextSource,
      nextSourceVersions,
      dependencySourceVersions: library.sourceVersions,
      tailwindSourceVersions,
      transactionDigest,
    });
    return {
      state: "create-ready",
      challengeId,
      documentId,
      createdDocument: document,
      documentDigest,
      nextSourceVersions,
      changes: [{
        fileId: entry.file.id,
        label: entry.file.displayName,
        beforeVersion: null,
        nextVersion: nextSourceVersions[entry.file.id],
      }],
      diff: createNewFileDiff(nextSource, entry.file.displayName),
      strictUi: evidence,
      compile: { status: "passed", checkedAt: new Date(this.#options.now()).toISOString() },
      transactionDigest,
      expiresAt: new Date(expiresAt).toISOString(),
    } satisfies ReadyDocumentCreate;
  }

  async save(challengeId: string): Promise<SavedDocument> {
    const challenge = this.#challenges.take(challengeId);
    if (!challenge) throw new DesignSpaceError("NOT_FOUND", "The prepared document creation does not exist");
    if (challenge.expiresAt <= this.#options.now()) {
      throw new DesignSpaceError("CHALLENGE_EXPIRED", "The prepared document creation expired before it was used");
    }
    const store = this.#store();
    if (!store) throw new DesignSpaceError("INVALID_REGISTRATION", "Managed document creation is no longer registered");
    if (this.#target.files.has(challenge.entry.file.id) || this.#documents().has(challenge.entry.target.id)) {
      throw new DesignSpaceError("STALE_SOURCE", "The managed document identity was registered before save");
    }
    this.#assertCapacity();
    await this.#options.library.assertUnchanged(challenge.dependencySourceVersions);
    await this.#options.tailwind.assertUnchanged(challenge.tailwindSourceVersions);
    await commitNewManagedFile(
      this.#target.root,
      store,
      challenge.entry.file,
      challenge.nextSource,
      {
        ...this.#options.transactionHooks,
        beforeInstall: async () => {
          this.#assertCapacity();
          await this.#options.library.assertUnchanged(challenge.dependencySourceVersions);
          await this.#options.tailwind.assertUnchanged(challenge.tailwindSourceVersions);
          await this.#options.transactionHooks?.beforeInstall?.();
        },
      },
    );
    const installed = await readFile(challenge.entry.file.path, "utf8");
    if (sourceVersion(installed) !== challenge.nextSourceVersions[challenge.entry.file.id]) {
      throw new DesignSpaceError("TRANSACTION_FAILED", "The managed document did not persist exactly");
    }
    installManagedDocumentEntry(this.#target.files, this.#documents(), challenge.entry);
    return {
      state: "saved",
      documentId: challenge.document.id,
      documentDigest: challenge.documentDigest,
      previousDocumentDigest: null,
      sourceVersions: challenge.nextSourceVersions,
      transactionDigest: challenge.transactionDigest,
    };
  }

  #store() {
    return this.#target.documentRegistration?.managed;
  }

  #documents() {
    const documents = this.#target.documentRegistration?.documents;
    if (!documents) throw new DesignSpaceError("INVALID_REGISTRATION", "Document registration is unavailable");
    return documents;
  }

  #registrationVersion(): string {
    return this.#target.documentRegistration?.version ?? "unregistered";
  }

  #assertCapacity(): void {
    if (this.#documents().size >= maximumDocumentCount) {
      throw new DesignSpaceError("VALIDATION_ERROR", "The document catalog is limited to 500 documents");
    }
  }

  #context(
    documentId: string,
    sources: Readonly<Record<string, string>>,
    libraryDocuments: readonly DesignDocument[] = [],
  ): DocumentTargetContext {
    return this.#options.library.context(documentId, sources, libraryDocuments);
  }

  async #strictUi(
    document: DesignDocument,
    context: DocumentTargetContext,
  ): Promise<readonly StrictUiViolation[]> {
    let violations: unknown;
    try {
      violations = await this.#store()?.strictUi?.(structuredClone(document), context) ?? [];
    } catch {
      throw new DesignSpaceError("VALIDATION_ERROR", "Strict UI validation could not complete");
    }
    const parsed = strictUiViolationSchema.array().max(2_000).safeParse(violations);
    if (!parsed.success) throw new DesignSpaceError("INVALID_REGISTRATION", "Strict UI returned invalid evidence");
    return parsed.data;
  }

  #evidence(
    documentId: string,
    documentDigest: string,
    sourceVersions: SourceVersionMap,
    violations: readonly StrictUiViolation[],
    checkedAt: string,
  ): StrictUiEvidence {
    return strictUiEvidenceSchema.parse({
      id: `evidence-${this.#options.createChallengeId()}`,
      projectId: this.#target.project.id,
      documentId,
      basis: {
        documentDigest,
        sourceVersion: sourceSetVersion(sourceVersions),
        ruleSetVersion: this.#registrationVersion(),
      },
      status: strictUiStatus(violations),
      checkedAt,
      violations,
    });
  }

  #compileBlocked(
    documentId: string,
    documentDigest: string,
    strictUi: StrictUiEvidence,
    message = "The target did not compile",
  ): CompileBlockedDocumentSave {
    return {
      state: "compile-blocked",
      documentId,
      documentDigest,
      strictUi,
      compile: {
        status: "failed",
        checkedAt: new Date(this.#options.now()).toISOString(),
        message,
      },
    };
  }
}
