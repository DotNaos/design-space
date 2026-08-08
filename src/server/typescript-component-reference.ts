import { isAbsolute, relative, sep } from "node:path";

import ts from "typescript";

import type { SourceWorkspaceLayer } from "../shared/source-workspace";

export function jsxComponentReference(
  tagName: ts.JsxTagNameExpression,
  kind: SourceWorkspaceLayer["kind"],
  checker: ts.TypeChecker,
  projectRoot: string,
): Pick<SourceWorkspaceLayer, "component"> {
  if (kind !== "component") return {};
  const symbol = checker.getSymbolAtLocation(tagName);
  if (!symbol) return {};
  const resolved = resolveAlias(symbol, checker);
  const sourceFile = resolved.declarations?.[0]?.getSourceFile();
  if (!sourceFile) return {};
  const relativePath = relative(projectRoot, sourceFile.fileName).split(sep).join("/");
  if (relativePath.startsWith("../") || isAbsolute(relativePath)) return {};
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  const exported = moduleSymbol && checker.getExportsOfModule(moduleSymbol).find(
    (candidate) => resolveAlias(candidate, checker) === resolved,
  );
  return exported
    ? { component: { relativePath, exportName: exported.getName() } }
    : {};
}

export function sourceComponentReferenceKey(reference: {
  relativePath: string;
  exportName: string;
}): string {
  return `${reference.relativePath.replaceAll("\\", "/")}#${reference.exportName}`;
}

function resolveAlias(symbol: ts.Symbol, checker: ts.TypeChecker): ts.Symbol {
  let current = symbol;
  const seen = new Set<ts.Symbol>();
  while ((current.flags & ts.SymbolFlags.Alias) && !seen.has(current)) {
    seen.add(current);
    current = checker.getAliasedSymbol(current);
  }
  return current;
}
