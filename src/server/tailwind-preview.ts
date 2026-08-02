import { lstat, readFile, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import { __unstable__loadDesignSystem, compile } from "tailwindcss";

import type { TailwindPreview } from "../shared/contracts";
import { DesignSpaceError } from "./errors";
import { validateTailwindClassList } from "./tailwind";
import type { TailwindCompilerContext, TrustedTailwindCompiler } from "./target-registration";

const maximumCacheEntries = 100;
const maximumPreviewCssBytes = 1_048_576;
const maximumWorkspaceStylesheetBytes = 1_048_576;
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

/** Compiles preview utilities against the CSS graph owned by one source root. */
export async function compileWorkspaceTailwindPreview(
  unsafeValue: string,
  root: string,
  stylePaths: readonly string[],
): Promise<TailwindPreview> {
  const value = validateTailwindClassList(unsafeValue);
  if (/url\(|image\(|@import/i.test(value)) {
    throw new DesignSpaceError("INVALID_TAILWIND", "External CSS resources are not allowed in a preview");
  }
  if (!stylePaths.length) return compileTailwindPreview(value);
  const trustedRoots = new Set([await realpath(root)]);
  const source = stylePaths.map((path) => `@import ${JSON.stringify(path)};`).join("\n");
  let designSystem;
  try {
    designSystem = await __unstable__loadDesignSystem(source, {
      base: root,
      loadStylesheet: (id, base) => loadWorkspaceStylesheet(id, base, trustedRoots),
    });
  } catch {
    throw new DesignSpaceError("COMPILE_ERROR", "The source workspace Tailwind styles could not be loaded");
  }
  const css = value ? value.split(" ").map((token) => {
    const candidate = designSystem.candidatesToCss([token]).find((result) => result !== null);
    if (!candidate) throw new DesignSpaceError("INVALID_TAILWIND", `Unknown Tailwind class: ${token}`);
    return candidate;
  }).join("\n") : "";
  return { value, css: validatePreviewCss(css) };
}

async function loadWorkspaceStylesheet(id: string, base: string, trustedRoots: Set<string>) {
  if (/^(?:https?:|data:)/i.test(id)) {
    throw new DesignSpaceError("ACCESS_DENIED", "Remote Tailwind stylesheets are not allowed");
  }
  let unresolved: string;
  if (isAbsolute(id)) unresolved = id;
  else if (id.startsWith(".")) unresolved = resolve(base, id);
  else {
    const resolvedPackage = await resolvePackageStylesheet(id, base);
    unresolved = resolvedPackage.path;
    trustedRoots.add(resolvedPackage.root);
  }
  const path = await realpath(unresolved);
  const metadata = await lstat(path);
  if (
    ![...trustedRoots].some((trustedRoot) => isWithin(trustedRoot, path))
    || !metadata.isFile()
    || !path.endsWith(".css")
    || metadata.size > maximumWorkspaceStylesheetBytes
  ) {
    throw new DesignSpaceError("ACCESS_DENIED", "The Tailwind stylesheet is not a bounded CSS file");
  }
  return { path, base: dirname(path), content: await readFile(path, "utf8") };
}

async function resolvePackageStylesheet(id: string, base: string): Promise<{ path: string; root: string }> {
  const requireFromBase = createRequire(join(base, "__design-space-tailwind__.cjs"));
  const segments = id.split("/");
  const packageName = id.startsWith("@") ? segments.slice(0, 2).join("/") : segments[0]!;
  const suffix = segments.slice(id.startsWith("@") ? 2 : 1).join("/");
  const manifestPath = await resolvePackageManifest(packageName, requireFromBase);
  const packageRoot = dirname(manifestPath);
  try {
    const exportedPath = requireFromBase.resolve(id);
    if (exportedPath.endsWith(".css")) return { path: exportedPath, root: packageRoot };
  } catch {
    // Fall through to packages that expose CSS only through the `style` condition.
  }
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    exports?: Record<string, unknown>;
    style?: string;
  };
  const key = suffix ? `./${suffix}` : ".";
  const exported = manifest.exports?.[key];
  const target = typeof exported === "string"
    ? exported
    : exported && typeof exported === "object" && !Array.isArray(exported)
      ? (exported as Record<string, unknown>).style
      : !suffix
        ? manifest.style
        : undefined;
  if (typeof target !== "string") {
    throw new DesignSpaceError("ACCESS_DENIED", "The imported package does not export a stylesheet");
  }
  return { path: resolve(packageRoot, target), root: packageRoot };
}

async function resolvePackageManifest(
  packageName: string,
  requireFromBase: NodeJS.Require,
): Promise<string> {
  if (!/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(packageName)) {
    throw new DesignSpaceError("ACCESS_DENIED", "The imported stylesheet package is invalid");
  }
  for (const searchRoot of requireFromBase.resolve.paths(packageName) ?? []) {
    const candidate = join(searchRoot, ...packageName.split("/"), "package.json");
    try {
      const path = await realpath(candidate);
      if ((await lstat(path)).isFile()) return path;
    } catch {
      // Try the next Node package search root.
    }
  }
  throw new DesignSpaceError("ACCESS_DENIED", "The imported stylesheet package is not installed");
}

function isWithin(root: string, candidate: string): boolean {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === "" || (!pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot));
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
