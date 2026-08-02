import { dirname, resolve } from "node:path";
import ts from "typescript";

import type { IndexedSourceFile } from "./source-file-index";
import { readRegisteredFile } from "./registered-file-reader";

export interface IndexedSourceDesign {
  design: IndexedSourceFile;
  exportName: string;
  source: IndexedSourceFile;
}

/**
 * Resolves a colocated design from the component value passed to
 * defineComponentDesign. File-name similarity is intentionally not enough:
 * one source module may export several components and each design belongs to
 * exactly one imported export.
 */
export async function indexSourceDesigns(
  root: string,
  files: readonly IndexedSourceFile[],
): Promise<ReadonlyMap<string, IndexedSourceDesign>> {
  const filesByAbsolutePath = new Map(files.map((file) => [file.absolutePath, file]));
  const result = new Map<string, IndexedSourceDesign>();
  for (const design of files.filter((file) => file.relativePath.endsWith(".design.tsx"))) {
    const binding = await readDesignBinding(root, design, filesByAbsolutePath);
    if (!binding) continue;
    result.set(sourceDesignKey(binding.source.relativePath, binding.exportName), {
      design,
      exportName: binding.exportName,
      source: binding.source,
    });
  }
  return result;
}

export function sourceDesignKey(relativePath: string, exportName: string): string {
  return `${relativePath}\0${exportName}`;
}

async function readDesignBinding(
  root: string,
  design: IndexedSourceFile,
  filesByAbsolutePath: ReadonlyMap<string, IndexedSourceFile>,
): Promise<{ exportName: string; source: IndexedSourceFile } | undefined> {
  const text = await readRegisteredFile(root, design.absolutePath, { maximumBytes: 512 * 1024 }).catch(() => undefined);
  if (!text) return undefined;
  const sourceFile = ts.createSourceFile(design.absolutePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const componentName = defaultDesignComponentName(sourceFile);
  if (!componentName) return undefined;
  const imported = importedComponent(sourceFile, componentName);
  if (!imported || !imported.module.startsWith(".")) return undefined;
  const source = resolveImportedFile(design, imported.module, filesByAbsolutePath);
  if (!source || dirname(source.absolutePath) !== dirname(design.absolutePath)) return undefined;
  return { exportName: imported.exportName, source };
}

function defaultDesignComponentName(sourceFile: ts.SourceFile): string | undefined {
  for (const statement of sourceFile.statements) {
    if (!ts.isExportAssignment(statement) || statement.isExportEquals || !ts.isCallExpression(statement.expression)) continue;
    const call = statement.expression;
    if (!isDefineComponentDesign(call.expression)) continue;
    const component = call.arguments[0];
    if (component && ts.isIdentifier(component)) return component.text;
  }
  return undefined;
}

function isDefineComponentDesign(expression: ts.Expression): boolean {
  return ts.isIdentifier(expression)
    ? expression.text === "defineComponentDesign"
    : ts.isPropertyAccessExpression(expression) && expression.name.text === "defineComponentDesign";
}

function importedComponent(
  sourceFile: ts.SourceFile,
  localName: string,
): { exportName: string; module: string } | undefined {
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const clause = statement.importClause;
    if (!clause) continue;
    if (clause.name?.text === localName) {
      return { exportName: "default", module: statement.moduleSpecifier.text };
    }
    const bindings = clause.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    const imported = bindings.elements.find((element) => element.name.text === localName);
    if (imported) {
      return {
        exportName: imported.propertyName?.text ?? imported.name.text,
        module: statement.moduleSpecifier.text,
      };
    }
  }
  return undefined;
}

function resolveImportedFile(
  design: IndexedSourceFile,
  moduleSpecifier: string,
  filesByAbsolutePath: ReadonlyMap<string, IndexedSourceFile>,
): IndexedSourceFile | undefined {
  const base = resolve(dirname(design.absolutePath), moduleSpecifier);
  for (const candidate of [base, `${base}.tsx`, `${base}.ts`, resolve(base, "index.tsx"), resolve(base, "index.ts")]) {
    const file = filesByAbsolutePath.get(candidate);
    if (file && !file.relativePath.endsWith(".design.tsx")) return file;
  }
  return undefined;
}
