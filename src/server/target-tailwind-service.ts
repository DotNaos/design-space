import { constants } from "node:fs";
import { open } from "node:fs/promises";

import type { DesignDocument } from "../shared/design-document";
import type { TailwindPreview } from "../shared/contracts";
import { DesignSpaceError } from "./errors";
import { assertStillRegistered } from "./path-security";
import { sourceVersion } from "./source-editor";
import { compileTailwindPreview } from "./tailwind-preview";
import type {
  DocumentTargetContext,
  RegisteredTarget,
  TailwindCompilerContext,
} from "./target-registration";

const maximumTailwindSourceBytes = 1_048_576;
const maximumTailwindSourceSetBytes = 4 * maximumTailwindSourceBytes;

export interface TargetTailwindResult {
  preview: TailwindPreview;
  sourceVersions: Readonly<Record<string, string>>;
}

/** Loads and verifies only the Tailwind sources fixed by trusted server registration. */
export class TargetTailwindService {
  readonly #target: RegisteredTarget;

  constructor(target: RegisteredTarget) {
    this.#target = target;
  }

  async compile(unsafeValue: string): Promise<TargetTailwindResult> {
    const compiler = this.#target.tailwindCompiler;
    if (!compiler) {
      return { preview: await compileTailwindPreview(unsafeValue), sourceVersions: Object.freeze({}) };
    }
    const context = await this.#readContext();
    let preview: TailwindPreview;
    try {
      preview = await compileTailwindPreview(unsafeValue, { compile: compiler.compile, context });
    } catch (error) {
      await this.assertUnchanged(context.sourceVersions);
      throw error;
    }
    await this.assertUnchanged(context.sourceVersions);
    return { preview, sourceVersions: context.sourceVersions };
  }

  async compileDocument(
    document: DesignDocument,
    context: DocumentTargetContext,
  ): Promise<TargetTailwindResult> {
    const collect = this.#target.documentRegistration?.tailwindClassList;
    if (!collect) throw new DesignSpaceError("INVALID_REGISTRATION", "Document Tailwind validation is not registered");
    let classList: unknown;
    try {
      classList = await collect(structuredClone(document), context);
    } catch {
      throw new DesignSpaceError("COMPILE_ERROR", "The target Tailwind validation failed");
    }
    if (typeof classList !== "string") {
      throw new DesignSpaceError("INVALID_REGISTRATION", "The target Tailwind collector returned invalid data");
    }
    return this.compile(classList);
  }

  async assertUnchanged(expected: Readonly<Record<string, string>>): Promise<void> {
    if (!this.#target.tailwindCompiler) return;
    const current = await this.#readContext();
    if (
      Object.keys(current.sourceVersions).length !== Object.keys(expected).length ||
      Object.entries(expected).some(([fileId, version]) => current.sourceVersions[fileId] !== version)
    ) {
      throw new DesignSpaceError("STALE_SOURCE", "A registered Tailwind source changed during validation");
    }
  }

  async #readContext(): Promise<TailwindCompilerContext> {
    const compiler = this.#target.tailwindCompiler;
    if (!compiler) {
      return Object.freeze({
        projectId: this.#target.project.id,
        sources: Object.freeze({}),
        sourceVersions: Object.freeze({}),
      });
    }
    const sources: Record<string, string> = {};
    const sourceVersions: Record<string, string> = {};
    let totalBytes = 0;
    for (const fileId of compiler.sourceFileIds) {
      const file = this.#target.files.get(fileId);
      if (!file) throw new DesignSpaceError("INVALID_REGISTRATION", "A Tailwind source file is not registered");
      await assertStillRegistered(this.#target.root, file.path);
      const handle = await open(file.path, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const metadata = await handle.stat();
        totalBytes += metadata.size;
        if (
          !metadata.isFile() ||
          metadata.size > maximumTailwindSourceBytes ||
          totalBytes > maximumTailwindSourceSetBytes
        ) {
          throw new DesignSpaceError("ACCESS_DENIED", "The registered Tailwind source set is too large");
        }
        const source = await handle.readFile("utf8");
        sources[fileId] = source;
        sourceVersions[fileId] = sourceVersion(source);
      } finally {
        await handle.close();
      }
      await assertStillRegistered(this.#target.root, file.path);
    }
    return Object.freeze({
      projectId: this.#target.project.id,
      sources: Object.freeze(sources),
      sourceVersions: Object.freeze(sourceVersions),
    });
  }
}
