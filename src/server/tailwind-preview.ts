import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

import { __unstable__loadDesignSystem, compile } from "tailwindcss";

import type { TailwindPreview } from "../shared/contracts";
import { DesignSpaceError } from "./errors";
import { validateTailwindClassList } from "./tailwind";
import type { TailwindCompilerContext, TrustedTailwindCompiler } from "./target-registration";

const maximumCacheEntries = 100;
const maximumPreviewCssBytes = 1_048_576;
const forbiddenCssResource = /@import\b|\b(?:url|image|image-set)\s*\(/i;
const cache = new Map<string, TailwindPreview>();
let fallbackRuntime: Promise<FallbackRuntime> | undefined;
const require = createRequire(import.meta.url);

interface FallbackRuntime {
  baseline: string;
  source: string;
  accepts(token: string): boolean;
}

export interface TargetTailwindCompilation {
  compile: TrustedTailwindCompiler["compile"];
  context: TailwindCompilerContext;
}

export async function compileTailwindPreview(
  unsafeValue: string,
  target?: TargetTailwindCompilation,
): Promise<TailwindPreview> {
  const value = validateTailwindClassList(unsafeValue);
  if (/url\(|image\(|@import/i.test(value)) {
    throw new DesignSpaceError("INVALID_TAILWIND", "External CSS resources are not allowed in a preview");
  }
  if (target) return compileWithTarget(value, target);

  const cached = cache.get(value);
  if (cached) return cached;

  const tokens = value ? value.split(" ") : [];
  const runtime = await getFallbackRuntime();
  for (const token of tokens) {
    if (!isSelectorOnlyToken(token) && !runtime.accepts(token)) {
      throw new DesignSpaceError("INVALID_TAILWIND", `Unknown Tailwind class: ${token}`);
    }
  }
  const css = tokens.length === 0 ? runtime.baseline : await build(runtime.source, tokens);
  const preview = { value, css: validatePreviewCss(css) };
  if (cache.size >= maximumCacheEntries) cache.delete(cache.keys().next().value ?? "");
  cache.set(value, preview);
  return preview;
}

async function compileWithTarget(value: string, target: TargetTailwindCompilation): Promise<TailwindPreview> {
  let css: unknown;
  try {
    css = await target.compile(value, freezeCompilerContext(target.context));
  } catch {
    throw new DesignSpaceError("COMPILE_ERROR", "The target Tailwind compiler failed");
  }
  return { value, css: validatePreviewCss(css) };
}

function freezeCompilerContext(context: TailwindCompilerContext): TailwindCompilerContext {
  return Object.freeze({
    projectId: context.projectId,
    sources: Object.freeze({ ...context.sources }),
    sourceVersions: Object.freeze({ ...context.sourceVersions }),
  });
}

function validatePreviewCss(value: unknown): string {
  if (typeof value !== "string" || Buffer.byteLength(value, "utf8") > maximumPreviewCssBytes) {
    throw new DesignSpaceError("INVALID_TAILWIND", "The Tailwind compiler returned invalid preview CSS");
  }
  const normalized = decodeCssEscapes(value.replace(/\/\*[\s\S]*?\*\//g, ""));
  if (forbiddenCssResource.test(normalized) || /<\/?(?:style|script)\b/i.test(normalized) || normalized.includes("\0")) {
    throw new DesignSpaceError("INVALID_TAILWIND", "External CSS resources are not allowed in a preview");
  }
  return value;
}

function decodeCssEscapes(value: string): string {
  return value.replace(/\\(?:([0-9a-f]{1,6})(?:\r\n|[\t\n\f\r ])?|([^\n\r\f]))/gi, (_match, hex, escaped) => {
    if (hex) {
      const codePoint = Number.parseInt(hex, 16);
      return codePoint === 0 || codePoint > 0x10ffff ? "\uFFFD" : String.fromCodePoint(codePoint);
    }
    return escaped ?? "";
  });
}

function isSelectorOnlyToken(token: string): boolean {
  return /^(?:dark|group|peer|(?:group|peer)\/[a-z0-9_-]+)$/i.test(token);
}

async function build(source: string, tokens: readonly string[]): Promise<string> {
  // Tailwind's build function accumulates candidates, so each uncached class
  // list gets a fresh builder while the expensive design system stays cached.
  const compiler = await compile(source);
  return compiler.build([...tokens]);
}

function getFallbackRuntime(): Promise<FallbackRuntime> {
  fallbackRuntime ??= createFallbackRuntime();
  return fallbackRuntime;
}

async function createFallbackRuntime(): Promise<FallbackRuntime> {
  const source = `${await readFile(require.resolve("tailwindcss/theme.css"), "utf8")}\n@tailwind utilities;`;
  const [baselineCompiler, designSystem] = await Promise.all([
    compile(source),
    __unstable__loadDesignSystem(source),
  ]);
  return {
    source,
    baseline: baselineCompiler.build([]),
    accepts: (token) => designSystem.candidatesToCss([token]).some((css) => css !== null),
  };
}
