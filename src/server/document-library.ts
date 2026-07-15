import { designDocumentSchema, type DesignDocument } from "../shared/design-document";
import type { SourceVersionMap } from "../shared/document-transactions";
import { assertSameVersions, freezeRecord, versionsFor } from "./document-service-values";
import { DesignSpaceError } from "./errors";
import { readRegisteredFile } from "./registered-file-reader";
import type {
  DocumentTargetContext,
  RegisteredDocumentTarget,
  RegisteredTarget,
} from "./target-registration";

export interface DocumentLibrarySnapshot {
  documents: readonly DesignDocument[];
  entries: readonly DocumentLibraryEntry[];
  sourceVersions: SourceVersionMap;
}

export interface DocumentLibraryEntry {
  target: RegisteredDocumentTarget;
  document: DesignDocument;
  sources: Readonly<Record<string, string>>;
}

/** Loads the authored-component library only from server-registered files. */
export class TrustedDocumentLibrary {
  readonly #target: RegisteredTarget;

  constructor(target: RegisteredTarget) {
    this.#target = target;
  }

  async capture(
    currentDocumentId: string,
    currentSources: Readonly<Record<string, string>>,
  ): Promise<DocumentLibrarySnapshot> {
    const targets = [...(this.#target.documentRegistration?.documents.values() ?? [])]
      .filter((candidate) => candidate.id !== currentDocumentId)
      .sort((left, right) => left.id.localeCompare(right.id, "en"));
    const currentFileIds = new Set(Object.keys(currentSources));
    const dependencyFileIds = [...new Set(targets.flatMap((target) => target.sourceFileIds))]
      .filter((fileId) => !currentFileIds.has(fileId))
      .sort((left, right) => left.localeCompare(right, "en"));
    const dependencySources = await this.#readFiles(dependencyFileIds);
    const sourceVersions = versionsFor(dependencySources);
    const availableSources = freezeRecord({ ...dependencySources, ...currentSources });
    const entries = await Promise.all(targets.map((target) => this.#load(target, availableSources)));
    const documents = entries.map((entry) => entry.document);
    await this.assertUnchanged(sourceVersions);
    return Object.freeze({
      documents: Object.freeze(documents),
      entries: Object.freeze(entries),
      sourceVersions,
    });
  }

  async assertUnchanged(expected: SourceVersionMap): Promise<void> {
    assertSameVersions(expected, versionsFor(await this.#readFiles(Object.keys(expected))));
  }

  context(
    documentId: string,
    sources: Readonly<Record<string, string>>,
    documents: readonly DesignDocument[] = [],
  ): DocumentTargetContext {
    return Object.freeze({
      projectId: this.#target.project.id,
      documentId,
      registrationVersion: this.#target.documentRegistration?.version ?? "unregistered",
      sources,
      libraryDocuments: Object.freeze(documents.map((document) => structuredClone(document))),
    });
  }

  async #readFiles(fileIds: readonly string[]): Promise<Readonly<Record<string, string>>> {
    const entries: Array<[string, string]> = [];
    for (const fileId of [...fileIds].sort((left, right) => left.localeCompare(right, "en"))) {
      const file = this.#target.files.get(fileId);
      if (!file) throw new DesignSpaceError("INVALID_REGISTRATION", "A document dependency is not registered");
      entries.push([fileId, await readRegisteredFile(this.#target.root, file.path)]);
    }
    return freezeRecord(Object.fromEntries(entries));
  }

  async #load(
    target: RegisteredDocumentTarget,
    availableSources: Readonly<Record<string, string>>,
  ): Promise<DocumentLibraryEntry> {
    const sources = freezeRecord(Object.fromEntries(target.sourceFileIds.map((fileId) => {
      const source = availableSources[fileId];
      if (source === undefined) {
        throw new DesignSpaceError("INVALID_REGISTRATION", "A document dependency source is unavailable");
      }
      return [fileId, source];
    })));
    let loaded: unknown;
    try {
      loaded = await target.load(sources, this.context(target.id, sources));
    } catch {
      throw new DesignSpaceError("INVALID_DOCUMENT", "An authored component dependency could not be loaded");
    }
    const parsed = designDocumentSchema.safeParse(loaded);
    if (!parsed.success || parsed.data.id !== target.id) {
      throw new DesignSpaceError("INVALID_DOCUMENT", "An authored component dependency is invalid");
    }
    return Object.freeze({ target, document: parsed.data, sources });
  }
}
