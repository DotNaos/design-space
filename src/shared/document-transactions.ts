import { z } from "zod";

import { designDocumentSchema, type DesignDocument } from "./design-document";
import { opaqueIdSchema, sourceVersionSchema } from "./ids";
import type { StrictUiEvidence } from "./strict-ui";

const sourceVersionsSchema = z.record(opaqueIdSchema, sourceVersionSchema).superRefine((versions, context) => {
  if (Object.keys(versions).length > 200) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Too many registered source versions" });
  }
});

export const documentOperationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("list-documents") }).strict(),
  z.object({ type: z.literal("read-document"), documentId: opaqueIdSchema }).strict(),
  z.object({
    type: z.literal("prepare-document-create"),
    recipeId: opaqueIdSchema,
    label: z.string().trim().min(1).max(120),
  }).strict(),
  z.object({
    type: z.literal("prepare-document-save"),
    documentId: opaqueIdSchema,
    baseDocumentDigest: sourceVersionSchema,
    baseSourceVersions: sourceVersionsSchema,
    document: designDocumentSchema,
  }).strict(),
  z.object({ type: z.literal("save-document"), challengeId: z.string().uuid() }).strict(),
]);

export type DocumentOperation = z.infer<typeof documentOperationSchema>;
export type SourceVersionMap = Readonly<Record<string, string>>;

export interface DocumentCatalogEntry {
  id: string;
  label: string;
  kind: "screen" | "component";
  group?: string;
  origin: "registered" | "managed";
}

export interface DocumentCreationRecipeEntry {
  id: string;
  label: string;
  description?: string;
  kind: "screen" | "component";
}

export interface DocumentCatalogFileEntry {
  id: string;
  label: string;
  kind: "directory" | "file";
  parentId?: string;
  editable?: boolean;
}

export interface DocumentCatalog {
  state: "catalog";
  documents: readonly DocumentCatalogEntry[];
  recipes: readonly DocumentCreationRecipeEntry[];
  /** Server-authoritative browser tree; file IDs are the only readable source inputs. */
  files: readonly DocumentCatalogFileEntry[];
}

export interface DocumentSnapshot {
  documentId: string;
  document: DesignDocument;
  documentDigest: string;
  sourceVersions: SourceVersionMap;
}

export interface DocumentCompileEvidence {
  status: "passed" | "failed";
  checkedAt: string;
  message?: string;
}

export interface DocumentSourceChange {
  fileId: string;
  label: string;
  beforeVersion: string;
  nextVersion: string;
}

export interface NewDocumentSourceChange {
  fileId: string;
  label: string;
  beforeVersion: null;
  nextVersion: string;
}

export interface StrictBlockedDocumentSave {
  state: "strict-blocked";
  documentId: string;
  documentDigest: string;
  strictUi: StrictUiEvidence;
}

export interface CompileBlockedDocumentSave {
  state: "compile-blocked";
  documentId: string;
  documentDigest: string;
  strictUi: StrictUiEvidence;
  compile: DocumentCompileEvidence & { status: "failed" };
}

export interface ReadyDocumentSave {
  state: "ready";
  challengeId: string;
  documentId: string;
  documentDigest: string;
  baseSourceVersions: SourceVersionMap;
  nextSourceVersions: SourceVersionMap;
  changes: readonly DocumentSourceChange[];
  diff: string;
  strictUi: StrictUiEvidence;
  compile: DocumentCompileEvidence & { status: "passed" };
  transactionDigest: string;
  expiresAt: string;
}

export interface ReadyDocumentCreate {
  state: "create-ready";
  challengeId: string;
  documentId: string;
  createdDocument: DesignDocument;
  documentDigest: string;
  nextSourceVersions: SourceVersionMap;
  changes: readonly NewDocumentSourceChange[];
  diff: string;
  strictUi: StrictUiEvidence;
  compile: DocumentCompileEvidence & { status: "passed" };
  transactionDigest: string;
  expiresAt: string;
}

export type PreparedDocumentSave =
  | StrictBlockedDocumentSave
  | CompileBlockedDocumentSave
  | ReadyDocumentSave;

export type PreparedDocumentCreate =
  | StrictBlockedDocumentSave
  | CompileBlockedDocumentSave
  | ReadyDocumentCreate;

export interface SavedDocument {
  state: "saved";
  documentId: string;
  documentDigest: string;
  previousDocumentDigest: string | null;
  sourceVersions: SourceVersionMap;
  transactionDigest: string;
}

export type DocumentOperationResult =
  | DocumentCatalog
  | DocumentSnapshot
  | PreparedDocumentCreate
  | PreparedDocumentSave
  | SavedDocument;
