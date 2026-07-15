import { canonicalJson } from "../shared/canonical-json";
import type { DesignDocument } from "../shared/design-document";
import type { SourceVersionMap } from "../shared/document-transactions";
import { DesignSpaceError } from "./errors";
import { sourceVersion } from "./source-editor";
import type { RegisteredDocumentTarget } from "./target-registration";

export function digestDocument(document: DesignDocument): string {
  return sourceVersion(canonicalJson(document));
}

export function versionsFor(sources: Readonly<Record<string, string>>): SourceVersionMap {
  return freezeRecord(Object.fromEntries(
    Object.entries(sources)
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([fileId, source]) => [fileId, sourceVersion(source)]),
  ));
}

export function sourceSetVersion(versions: SourceVersionMap): string {
  return sourceVersion(canonicalJson(versions));
}

export function freezeRecord(value: Record<string, string>): Readonly<Record<string, string>> {
  return Object.freeze({ ...value });
}

export function mergeSourceVersions(
  sources: SourceVersionMap,
  dependencies: SourceVersionMap,
  tailwind: SourceVersionMap = {},
): SourceVersionMap {
  return freezeRecord({ ...dependencies, ...tailwind, ...sources });
}

export function assertDocumentIdentity(documentId: string, document: DesignDocument): void {
  if (document.id !== documentId) {
    throw new DesignSpaceError("INVALID_REQUEST", "The document identity does not match the registered target");
  }
}

export function assertExactSourceSet(document: RegisteredDocumentTarget, versions: SourceVersionMap): void {
  const expected = [...document.sourceFileIds].sort();
  const received = Object.keys(versions).sort();
  if (canonicalJson(expected) !== canonicalJson(received)) {
    throw new DesignSpaceError("INVALID_REQUEST", "The browser source version set is not registered for this document");
  }
}

export function assertSameVersions(expected: SourceVersionMap, actual: SourceVersionMap): void {
  if (canonicalJson(expected) !== canonicalJson(actual)) {
    throw new DesignSpaceError("STALE_SOURCE", "A registered source changed after the document loaded");
  }
}

export function validateMaterialization(
  document: RegisteredDocumentTarget,
  materialized: unknown,
): Readonly<Record<string, string>> {
  if (!materialized || typeof materialized !== "object" || Array.isArray(materialized)) {
    throw new DesignSpaceError("INVALID_REGISTRATION", "Document materialization must return registered sources");
  }
  const record = materialized as Record<string, unknown>;
  const expected = [...document.writeFileIds].sort();
  const received = Object.keys(record).sort();
  if (
    canonicalJson(expected) !== canonicalJson(received) ||
    received.some((fileId) => typeof record[fileId] !== "string")
  ) {
    throw new DesignSpaceError("INVALID_REGISTRATION", "Document materialization returned an unregistered file set");
  }
  return freezeRecord(Object.fromEntries(received.map((fileId) => [fileId, record[fileId] as string])));
}
