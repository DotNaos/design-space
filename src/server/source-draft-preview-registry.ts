import { normalizePath } from "vite";

import type { SourceDesignScope } from "../shared/source-design";
import type { IndexedSourceFile, IndexedSourceWorkspace } from "./source-file-index";
import { readRegisteredFile } from "./registered-file-reader";

export const SOURCE_DRAFT_PREVIEW_MODULE_PREFIX = "virtual:design-space-source-preview/";
export const SOURCE_DRAFT_PREVIEW_URL_PREFIX = "/__design-space/source-preview/";

type PreviewChange = { fileId: string; source: string };

type PreviewSet = {
  changes: ReadonlyMap<string, string>;
  expiresAt: number;
  files: ReadonlyMap<string, IndexedSourceFile>;
  filesByPath: ReadonlyMap<string, IndexedSourceFile>;
  root: string;
  scope: SourceDesignScope;
};

export type PreparedSourcePreviewModule = {
  challengeId: string;
  file: IndexedSourceFile;
  fileId: string;
  source: string;
};

/**
 * Holds only server-validated drafts in memory. Vite can execute these modules
 * for review without installing them into either repository root.
 */
export class SourceDraftPreviewRegistry {
  readonly #sets = new Map<string, PreviewSet>();

  constructor(private readonly now: () => number = Date.now) {}

  register(input: {
    challengeId: string;
    scope: SourceDesignScope;
    workspace: IndexedSourceWorkspace;
    changes: readonly PreviewChange[];
    expiresAt: number;
  }): void {
    this.pruneExpired();
    const files = new Map(input.workspace.files.map((file) => [file.id, file]));
    this.#sets.set(input.challengeId, {
      changes: new Map(input.changes.map((change) => [change.fileId, change.source])),
      expiresAt: input.expiresAt,
      files,
      filesByPath: new Map(input.workspace.files.map((file) => [normalizePath(file.absolutePath), file])),
      root: input.workspace.root,
      scope: input.scope,
    });
  }

  remove(challengeId: string): void {
    this.#sets.delete(challengeId);
  }

  pruneExpired(): number {
    const now = this.now();
    let removed = 0;
    for (const [challengeId, set] of this.#sets) {
      if (set.expiresAt > now) continue;
      this.#sets.delete(challengeId);
      removed += 1;
    }
    return removed;
  }

  get liveSize(): number {
    this.pruneExpired();
    return this.#sets.size;
  }

  metadata(challengeId: string, fileId: string): IndexedSourceFile | undefined {
    return this.#active(challengeId)?.files.get(fileId);
  }

  fileForPath(challengeId: string, path: string): IndexedSourceFile | undefined {
    return this.#active(challengeId)?.filesByPath.get(normalizePath(path.split("?", 1)[0] ?? path));
  }

  async load(challengeId: string, fileId: string): Promise<PreparedSourcePreviewModule | undefined> {
    const set = this.#active(challengeId);
    const file = set?.files.get(fileId);
    if (!set || !file) return undefined;
    return {
      challengeId,
      file,
      fileId,
      source: set.changes.get(fileId) ?? await readRegisteredFile(set.root, file.absolutePath, {
        maximumBytes: 512 * 1024,
        unavailableMessage: "A prepared preview dependency is unavailable",
      }),
    };
  }

  originalImporter(challengeId: string, fileId: string): string | undefined {
    return this.metadata(challengeId, fileId)?.absolutePath;
  }

  #active(challengeId: string): PreviewSet | undefined {
    const set = this.#sets.get(challengeId);
    if (set && set.expiresAt > this.now()) return set;
    if (set) this.#sets.delete(challengeId);
    return undefined;
  }
}

export function sourceDraftPreviewModuleId(challengeId: string, fileId: string, relativePath: string): string {
  return `${SOURCE_DRAFT_PREVIEW_MODULE_PREFIX}${encodeURIComponent(challengeId)}/${encodeURIComponent(fileId)}/module${previewModuleExtension(relativePath)}`;
}

export function sourceDraftPreviewModuleUrl(challengeId: string, fileId: string, relativePath: string): string {
  return `${SOURCE_DRAFT_PREVIEW_URL_PREFIX}${encodeURIComponent(challengeId)}/${encodeURIComponent(fileId)}/module${previewModuleExtension(relativePath)}`;
}

export function parseSourceDraftPreviewModuleId(id: string): { challengeId: string; fileId: string } | undefined {
  const normalized = (id.startsWith("\0") ? id.slice(1) : id).split(/[?#]/, 1)[0] ?? id;
  const virtual = normalized.startsWith(SOURCE_DRAFT_PREVIEW_MODULE_PREFIX);
  const routed = normalized.startsWith(SOURCE_DRAFT_PREVIEW_URL_PREFIX);
  if (!virtual && !routed) return undefined;
  const value = virtual
    ? normalized.slice(SOURCE_DRAFT_PREVIEW_MODULE_PREFIX.length)
    : normalized.slice(SOURCE_DRAFT_PREVIEW_URL_PREFIX.length);
  const [challenge, file, moduleName, ...rest] = value.split("/");
  if (!challenge || !file || !moduleName || rest.length || !/^module\.[a-z0-9]+$/i.test(moduleName)) return undefined;
  try {
    return { challengeId: decodeURIComponent(challenge), fileId: decodeURIComponent(file) };
  } catch {
    return undefined;
  }
}

function previewModuleExtension(relativePath: string): string {
  const path = relativePath.split(/[?#]/, 1)[0] ?? relativePath;
  const extension = path.match(/\.[a-z0-9]+$/i)?.[0];
  return extension?.toLowerCase() ?? ".js";
}
