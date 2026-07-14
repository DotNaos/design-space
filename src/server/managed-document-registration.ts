import { lstat, readFile, readdir, stat } from "node:fs/promises";
import { basename, join, relative } from "node:path";

import { canonicalJson } from "../shared/canonical-json";
import { designDocumentSchema, type DesignDocument } from "../shared/design-document";
import type { StrictUiViolation } from "../shared/strict-ui";
import { DesignSpaceError } from "./errors";
import {
  assertStillRegisteredDirectory,
  canonicalRegisteredDirectory,
  canonicalRegisteredFile,
} from "./path-security";
import type {
  DocumentTargetContext,
  ManagedDocumentRecipeContext,
  RegisteredDocumentTarget,
  RegisteredFile,
} from "./target-registration";

const managedDocumentName = /^([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})\.design\.json$/;

export interface TrustedManagedDocumentRecipe {
  label: string;
  description?: string;
  kind: "screen" | "component";
  create: (
    input: Readonly<{ documentId: string; label: string }>,
    context: ManagedDocumentRecipeContext,
  ) => unknown | Promise<unknown>;
}

export interface TrustedManagedDocumentStore {
  directory: string;
  recipes: Readonly<Record<string, TrustedManagedDocumentRecipe>>;
  strictUi?: (
    document: DesignDocument,
    context: DocumentTargetContext,
  ) => readonly StrictUiViolation[] | Promise<readonly StrictUiViolation[]>;
  compile?: (
    nextSources: Readonly<Record<string, string>>,
    context: DocumentTargetContext,
  ) => void | Promise<void>;
}

export interface RegisteredManagedDocumentRecipe extends TrustedManagedDocumentRecipe {
  id: string;
}

export interface RegisteredManagedDocumentDirectory {
  path: string;
  displayName: string;
  device: number;
  inode: number;
}

export interface RegisteredManagedDocumentStore {
  directory: RegisteredManagedDocumentDirectory;
  recipes: ReadonlyMap<string, RegisteredManagedDocumentRecipe>;
  strictUi?: TrustedManagedDocumentStore["strictUi"];
  compile?: TrustedManagedDocumentStore["compile"];
}

export interface ManagedDocumentEntry {
  file: RegisteredFile;
  target: RegisteredDocumentTarget;
}

interface RegistrationInput {
  root: string;
  config: TrustedManagedDocumentStore;
  files: Map<string, RegisteredFile>;
  documents: Map<string, RegisteredDocumentTarget>;
}

export async function registerManagedDocumentStore(input: RegistrationInput): Promise<RegisteredManagedDocumentStore> {
  const directoryPath = await canonicalRegisteredDirectory(input.root, input.config.directory);
  const directoryStat = await stat(directoryPath);
  const recipes = new Map(Object.entries(input.config.recipes).map(([id, recipe]) => [id, { id, ...recipe }]));
  if (recipes.size === 0 || recipes.size > 100) {
    throw new DesignSpaceError("INVALID_REGISTRATION", "Managed documents require between one and 100 recipes");
  }
  const store: RegisteredManagedDocumentStore = {
    directory: {
      path: directoryPath,
      displayName: relative(input.root, directoryPath).replaceAll("\\", "/"),
      device: directoryStat.dev,
      inode: directoryStat.ino,
    },
    recipes,
    strictUi: input.config.strictUi,
    compile: input.config.compile,
  };

  const entries = await readdir(directoryPath, { withFileTypes: true });
  const managedNames = entries.filter((entry) => entry.name.endsWith(".design.json"));
  if (managedNames.length > 500) {
    throw new DesignSpaceError("INVALID_REGISTRATION", "The managed document catalog exceeds 500 documents");
  }
  for (const directoryEntry of managedNames) {
    const uuid = parseManagedFileName(directoryEntry.name);
    const expectedPath = join(directoryPath, directoryEntry.name);
    const fileStat = await lstat(expectedPath);
    if (!directoryEntry.isFile() || !fileStat.isFile() || fileStat.isSymbolicLink()) {
      throw new DesignSpaceError("ACCESS_DENIED", "Managed documents must be regular files");
    }
    const path = await canonicalRegisteredFile(input.root, relative(input.root, expectedPath));
    const parsed = designDocumentSchema.safeParse(await parseStoredDocument(path));
    if (!parsed.success || parsed.data.id !== `${parsed.data.kind}.${uuid}`) {
      throw new DesignSpaceError("INVALID_DOCUMENT", "A managed document has an invalid shape or identity");
    }
    installManagedDocumentEntry(input.files, input.documents, createManagedDocumentEntry(input.root, store, parsed.data));
  }
  await assertManagedDirectoryIdentity(input.root, store);
  if (input.documents.size > 500) {
    throw new DesignSpaceError("INVALID_REGISTRATION", "The total document catalog exceeds 500 documents");
  }
  return store;
}

export function createManagedDocumentEntry(
  root: string,
  store: RegisteredManagedDocumentStore,
  document: DesignDocument,
): ManagedDocumentEntry {
  const uuid = managedUuid(document);
  const fileId = `managed.${uuid}`;
  const path = join(store.directory.path, `${uuid}.design.json`);
  return {
    file: {
      id: fileId,
      path,
      displayName: relative(root, path).replaceAll("\\", "/"),
    },
    target: {
      id: document.id,
      origin: "managed",
      sourceFileIds: [fileId],
      writeFileIds: [fileId],
      load: (sources) => JSON.parse(sources[fileId]),
      materialize: (nextDocument) => ({
        [fileId]: `${canonicalJson(designDocumentSchema.parse(nextDocument), 2)}\n`,
      }),
      strictUi: store.strictUi,
      compile: store.compile,
    },
  };
}

export function installManagedDocumentEntry(
  files: Map<string, RegisteredFile>,
  documents: Map<string, RegisteredDocumentTarget>,
  entry: ManagedDocumentEntry,
): void {
  if (files.has(entry.file.id) || documents.has(entry.target.id)) {
    throw new DesignSpaceError("INVALID_REGISTRATION", "A managed document collides with a registered target ID");
  }
  files.set(entry.file.id, entry.file);
  documents.set(entry.target.id, entry.target);
}

export async function assertManagedDirectoryIdentity(
  root: string,
  store: RegisteredManagedDocumentStore,
): Promise<void> {
  await assertStillRegisteredDirectory(root, store.directory.path);
  const current = await stat(store.directory.path);
  if (current.dev !== store.directory.device || current.ino !== store.directory.inode) {
    throw new DesignSpaceError("ACCESS_DENIED", "The managed document directory changed after registration");
  }
}

export function managedRecipeContext(
  projectId: string,
  registrationVersion: string,
  documentId: string,
  recipeId: string,
): ManagedDocumentRecipeContext {
  return Object.freeze({ projectId, registrationVersion, documentId, recipeId });
}

function managedUuid(document: DesignDocument): string {
  const prefix = `${document.kind}.`;
  const uuid = document.id.startsWith(prefix) ? document.id.slice(prefix.length) : "";
  if (!managedDocumentName.test(`${uuid}.design.json`)) {
    throw new DesignSpaceError("INVALID_REGISTRATION", "Managed document identities must be server-generated UUIDs");
  }
  return uuid;
}

function parseManagedFileName(name: string): string {
  const match = managedDocumentName.exec(basename(name));
  if (!match) {
    throw new DesignSpaceError("INVALID_REGISTRATION", "Managed document filenames must be server-generated UUIDs");
  }
  return match[1];
}

async function parseStoredDocument(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    throw new DesignSpaceError("INVALID_DOCUMENT", "A managed document does not contain valid JSON");
  }
}
