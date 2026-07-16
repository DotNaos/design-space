import { isAbsolute, join, relative, sep } from "node:path";

import ts from "typescript";

import type {
  SourceLayerClassNameBinding,
  SourceLayerTextBinding,
  SourceComponentSlot,
  SourceStrictUiFinding,
  SourceWorkspaceLayer,
} from "../shared/source-workspace";
import { DesignSpaceError } from "./errors";
import {
  assertStillRegistered,
  canonicalRegisteredFile,
  canonicalRoot,
} from "./path-security";
import { sourceWorkspaceLayerId } from "./source-layer-annotation";
import { extractComponentContract } from "./typescript-component-contract";

export interface IndexedTypeScriptComponent {
  filePath: string;
  exportName: string;
  label: string;
  propsTypeText: string;
  props: ReturnType<typeof extractComponentContract>["props"];
  slots: readonly SourceComponentSlot[];
  findings: readonly SourceStrictUiFinding[];
  source: { start: number; end: number };
  uses: readonly string[];
  layers: readonly SourceWorkspaceLayer[];
}

export interface TypeScriptComponentIndexOptions {
  projectRoot: string;
  filePaths: readonly string[];
  sourceOverrides?: ReadonlyMap<string, string>;
}

/**
 * Reads component props from the project's TypeScript source. It deliberately
 * produces no authored component schema: the compiler-resolved types remain
 * the source of truth.
 */
export async function indexTypeScriptComponents(
  options: TypeScriptComponentIndexOptions,
): Promise<readonly IndexedTypeScriptComponent[]> {
  const projectRoot = await canonicalRoot(options.projectRoot);
  const filePaths = await canonicalSourceFiles(projectRoot, options.filePaths);
  const compilerOptions = readCompilerOptions(projectRoot);
  const host = ts.createCompilerHost(compilerOptions, true);
  if (options.sourceOverrides?.size) {
    const readFile = host.readFile.bind(host);
    host.readFile = (candidate) => options.sourceOverrides?.get(candidate)
      ?? options.sourceOverrides?.get(candidate.replaceAll("\\", "/"))
      ?? readFile(candidate);
  }
  const program = ts.createProgram({ rootNames: filePaths, options: compilerOptions, host });
  const checker = program.getTypeChecker();
  const components: IndexedTypeScriptComponent[] = [];

  for (const filePath of filePaths) {
    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) {
      throw new DesignSpaceError("COMPILE_ERROR", "TypeScript could not load a registered source file");
    }
    components.push(...indexSourceFile(sourceFile, checker, projectRoot));
  }

  return components.sort((left, right) =>
    left.filePath.localeCompare(right.filePath) || left.exportName.localeCompare(right.exportName));
}

async function canonicalSourceFiles(
  projectRoot: string,
  requestedPaths: readonly string[],
): Promise<string[]> {
  const paths = await Promise.all(requestedPaths.map(async (requestedPath) => {
    const relativePath = isAbsolute(requestedPath)
      ? relative(projectRoot, requestedPath)
      : requestedPath;
    const filePath = await canonicalRegisteredFile(projectRoot, relativePath);
    if (!filePath.endsWith(".ts") && !filePath.endsWith(".tsx")) {
      throw new DesignSpaceError(
        "INVALID_REGISTRATION",
        "TypeScript component sources must use a .ts or .tsx extension",
      );
    }
    await assertStillRegistered(projectRoot, filePath);
    return filePath;
  }));
  return [...new Set(paths)];
}

function readCompilerOptions(projectRoot: string): ts.CompilerOptions {
  const defaults: ts.CompilerOptions = {
    allowJs: false,
    esModuleInterop: true,
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    skipLibCheck: true,
    strict: true,
    target: ts.ScriptTarget.ES2022,
  };
  const applicationConfigPath = join(projectRoot, "tsconfig.app.json");
  const configPath = ts.sys.fileExists(applicationConfigPath)
    ? applicationConfigPath
    : join(projectRoot, "tsconfig.json");
  if (!ts.sys.fileExists(configPath)) return defaults;

  const diagnostics: ts.Diagnostic[] = [];
  const parsed = ts.getParsedCommandLineOfConfigFile(configPath, {}, {
    fileExists: ts.sys.fileExists,
    getCurrentDirectory: () => projectRoot,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
      diagnostics.push(diagnostic);
    },
    readDirectory: ts.sys.readDirectory,
    readFile: ts.sys.readFile,
    useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
  });
  if (!parsed) {
    const detail = diagnostics[0]
      ? ts.flattenDiagnosticMessageText(diagnostics[0].messageText, " ")
      : "The TypeScript project configuration could not be read";
    throw new DesignSpaceError("COMPILE_ERROR", detail);
  }
  return { ...defaults, ...parsed.options, allowJs: false, noEmit: true };
}

function indexSourceFile(
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  projectRoot: string,
): IndexedTypeScriptComponent[] {
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) return [];

  const components: IndexedTypeScriptComponent[] = [];
  const localComponents = localJsxDeclarations(sourceFile);
  const relativePath = relative(projectRoot, sourceFile.fileName).split(sep).join("/");
  for (const exportedSymbol of checker.getExportsOfModule(moduleSymbol)) {
    const resolvedSymbol = resolveAlias(exportedSymbol, checker);
    const declaration = resolvedSymbol.declarations?.find(
      (candidate) => candidate.getSourceFile() === sourceFile,
    );
    if (!declaration) continue;

    const exportName = exportedSymbol.getName();
    const label = componentLabel(exportName, declaration);
    if (!label || !/^[A-Z]/.test(label)) continue;

    const componentType = checker.getTypeOfSymbolAtLocation(resolvedSymbol, declaration);
    const signature = findReactComponentSignature(
      componentType,
      declaration,
      checker,
      new Set(),
    );
    if (!signature) continue;

    const contract = extractComponentContract(signature, declaration, checker);
    const layers = jsxLayers(
      declaration,
      localComponents,
      new Set([label]),
      relativePath,
      new Set(contract.slots.map((slot) => slot.name)),
    );
    const renderedSlots = collectRenderedSlots(layers);
    const findings = [...contract.findings];
    for (const slot of contract.slots) {
      if (!renderedSlots.has(slot.name)) {
        findings.push({
          ruleId: "strict-ui.slot-not-rendered",
          severity: "error",
          message: `Slot ${slot.name} is declared but is not rendered by ${label}.`,
        });
      }
    }
    components.push({
      exportName,
      filePath: relativePath,
      label,
      props: contract.props,
      slots: contract.slots,
      findings,
      propsTypeText: contract.typeText,
      source: { start: declaration.getStart(), end: declaration.getEnd() },
      uses: jsxComponentNames(declaration),
      layers,
    });
  }
  return components;
}

function jsxLayers(
  declaration: ts.Declaration,
  localComponents: ReadonlyMap<string, ts.Declaration>,
  path: ReadonlySet<string>,
  relativePath: string,
  slotNames: ReadonlySet<string>,
): readonly SourceWorkspaceLayer[] {
  const layers: SourceWorkspaceLayer[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxElement(node) && isFragmentTag(node.openingElement.tagName.getText())) {
      node.children.forEach(visit);
      return;
    }
    if (ts.isJsxSelfClosingElement(node) && isFragmentTag(node.tagName.getText())) return;
    const layer = jsxLayer(node, localComponents, path, relativePath, slotNames);
    if (layer) {
      layers.push(layer);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(declaration);
  return layers;
}

function jsxLayer(
  node: ts.Node,
  localComponents: ReadonlyMap<string, ts.Declaration>,
  path: ReadonlySet<string>,
  relativePath: string,
  slotNames: ReadonlySet<string>,
): SourceWorkspaceLayer | undefined {
  if (ts.isJsxElement(node)) {
    const label = node.openingElement.tagName.getText();
    const kind = jsxLayerKind(label);
    return {
      id: sourceWorkspaceLayerId(relativePath, node.getStart()),
      label,
      kind,
      source: { start: node.getStart(), end: node.getEnd() },
      ...jsxClassName(node.openingElement, kind),
      ...jsxStaticText(node),
      children: [
        ...localComponentLayers(label, kind, localComponents, path, relativePath),
        ...jsxChildLayers(node.children, localComponents, path, relativePath, slotNames),
      ],
    };
  }
  if (ts.isJsxSelfClosingElement(node)) {
    const label = node.tagName.getText();
    const kind = jsxLayerKind(label);
    return {
      id: sourceWorkspaceLayerId(relativePath, node.getStart()),
      label,
      kind,
      source: { start: node.getStart(), end: node.getEnd() },
      ...jsxClassName(node, kind),
      children: localComponentLayers(label, kind, localComponents, path, relativePath),
    };
  }
  return undefined;
}

function jsxClassName(
  opening: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  kind: SourceWorkspaceLayer["kind"],
): Pick<SourceWorkspaceLayer, "className" | "classNameDynamic"> {
  if (kind !== "html") return {};
  const attribute = opening.attributes.properties.find((property): property is ts.JsxAttribute => (
    ts.isJsxAttribute(property) && property.name.getText() === "className"
  ));
  if (!attribute) {
    return {
      className: {
        value: "",
        start: opening.tagName.end,
        end: opening.tagName.end,
        insert: true,
      },
    };
  }
  const staticValue = staticJsxAttributeValue(attribute.initializer);
  if (!staticValue) return { classNameDynamic: true };
  const className: SourceLayerClassNameBinding = {
    value: staticValue.value,
    start: attribute.getStart(),
    end: attribute.getEnd(),
    syntax: staticValue.syntax,
  };
  return { className };
}

function jsxStaticText(
  element: ts.JsxElement,
): Pick<SourceWorkspaceLayer, "text"> {
  const bindings = element.children.flatMap((child): SourceLayerTextBinding[] => {
    if (ts.isJsxText(child)) {
      const sourceText = child.getText();
      if (!sourceText.trim() || sourceText !== sourceText.trim() || /[\r\n]/.test(sourceText)) return [];
      return [{
        value: decodeJsxText(sourceText),
        start: child.getStart(),
        end: child.getEnd(),
        syntax: "text",
      }];
    }
    if (!ts.isJsxExpression(child) || !child.expression) return [];
    if (!ts.isStringLiteral(child.expression) && !ts.isNoSubstitutionTemplateLiteral(child.expression)) return [];
    return [{
      value: child.expression.text,
      start: child.getStart(),
      end: child.getEnd(),
      syntax: "expression",
    }];
  });
  return bindings.length === 1 ? { text: bindings[0] } : {};
}

function decodeJsxText(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&#123;", "{")
    .replaceAll("&#125;", "}")
    .replaceAll("&amp;", "&");
}

function staticJsxAttributeValue(
  initializer: ts.JsxAttributeValue | undefined,
): Pick<SourceLayerClassNameBinding, "value" | "syntax"> | undefined {
  if (!initializer) return undefined;
  if (ts.isStringLiteral(initializer)) return { value: initializer.text, syntax: "attribute" };
  if (!ts.isJsxExpression(initializer) || !initializer.expression) return undefined;
  if (ts.isStringLiteral(initializer.expression) || ts.isNoSubstitutionTemplateLiteral(initializer.expression)) {
    return { value: initializer.expression.text, syntax: "expression" };
  }
  return undefined;
}

function jsxChildLayers(
  children: ts.NodeArray<ts.JsxChild>,
  localComponents: ReadonlyMap<string, ts.Declaration>,
  path: ReadonlySet<string>,
  relativePath: string,
  slotNames: ReadonlySet<string>,
): readonly SourceWorkspaceLayer[] {
  return children.flatMap((child) => {
    if (ts.isJsxFragment(child)) {
      return jsxChildLayers(child.children, localComponents, path, relativePath, slotNames);
    }
    if (ts.isJsxElement(child) && isFragmentTag(child.openingElement.tagName.getText())) {
      return jsxChildLayers(child.children, localComponents, path, relativePath, slotNames);
    }
    if (ts.isJsxSelfClosingElement(child) && isFragmentTag(child.tagName.getText())) return [];
    const slot = sourceSlotLayer(child, slotNames, relativePath);
    if (slot) return [slot];
    const direct = jsxLayer(child, localComponents, path, relativePath, slotNames);
    if (direct) return [direct];
    if (!ts.isJsxExpression(child) || !child.expression) return [];
    const nested: SourceWorkspaceLayer[] = [];
    const visit = (node: ts.Node): void => {
      const layer = jsxLayer(node, localComponents, path, relativePath, slotNames);
      if (layer) {
        nested.push(layer);
        return;
      }
      ts.forEachChild(node, visit);
    };
    visit(child.expression);
    return nested;
  });
}

function sourceSlotLayer(
  child: ts.JsxChild,
  slotNames: ReadonlySet<string>,
  relativePath: string,
): SourceWorkspaceLayer | undefined {
  if (!ts.isJsxExpression(child) || !child.expression) return undefined;
  const name = sourceSlotName(child.expression);
  if (!name || !slotNames.has(name)) return undefined;
  return {
    id: sourceWorkspaceLayerId(relativePath, child.getStart()),
    label: name,
    kind: "slot",
    source: { start: child.getStart(), end: child.getEnd() },
    children: [],
  };
}

function sourceSlotName(expression: ts.Expression): string | undefined {
  if (!ts.isPropertyAccessExpression(expression)) return undefined;
  const owner = expression.expression;
  if (ts.isIdentifier(owner) && owner.text === "slots") return expression.name.text;
  if (
    ts.isPropertyAccessExpression(owner) &&
    owner.name.text === "slots"
  ) {
    return expression.name.text;
  }
  return undefined;
}

function collectRenderedSlots(layers: readonly SourceWorkspaceLayer[]): ReadonlySet<string> {
  const result = new Set<string>();
  const visit = (layer: SourceWorkspaceLayer): void => {
    if (layer.kind === "slot") result.add(layer.label);
    layer.children.forEach(visit);
  };
  layers.forEach(visit);
  return result;
}

function localComponentLayers(
  label: string,
  kind: SourceWorkspaceLayer["kind"],
  localComponents: ReadonlyMap<string, ts.Declaration>,
  path: ReadonlySet<string>,
  relativePath: string,
): readonly SourceWorkspaceLayer[] {
  if (kind !== "component" || path.has(label)) return [];
  const declaration = localComponents.get(label);
  if (!declaration) return [];
  return jsxLayers(declaration, localComponents, new Set(path).add(label), relativePath, new Set());
}

function localJsxDeclarations(sourceFile: ts.SourceFile): ReadonlyMap<string, ts.Declaration> {
  const declarations = new Map<string, ts.Declaration>();
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name && containsJsx(statement)) {
      declarations.set(statement.name.text, statement);
      continue;
    }
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer && containsJsx(declaration.initializer)) {
        declarations.set(declaration.name.text, declaration);
      }
    }
  }
  return declarations;
}

function jsxLayerKind(label: string): SourceWorkspaceLayer["kind"] {
  return /^[a-z]/.test(label) || label.includes("-") ? "html" : "component";
}

function isFragmentTag(label: string): boolean {
  return label === "Fragment" || label === "React.Fragment";
}

function jsxComponentNames(declaration: ts.Declaration): readonly string[] {
  const names = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName;
      if (ts.isIdentifier(tag) && /^[A-Z]/.test(tag.text) && tag.text !== "Fragment") {
        names.add(tag.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(declaration);
  return [...names].sort((left, right) => left.localeCompare(right, "en"));
}

function findReactComponentSignature(
  type: ts.Type,
  declaration: ts.Declaration,
  checker: ts.TypeChecker,
  seen: Set<ts.Type>,
): ts.Signature | undefined {
  if (seen.has(type)) return undefined;
  seen.add(type);
  const direct = type.getCallSignatures().find(
    (candidate) => isReactComponentSignature(candidate, declaration, checker),
  );
  if (direct) return direct;
  if (type.isUnionOrIntersection()) {
    for (const part of type.types) {
      const nested = findReactComponentSignature(part, declaration, checker, new Set(seen));
      if (nested) return nested;
    }
  }
  return undefined;
}

function componentLabel(exportName: string, declaration: ts.Declaration): string | undefined {
  if (exportName !== "default") return exportName;
  if (
    (ts.isFunctionDeclaration(declaration) || ts.isClassDeclaration(declaration)) &&
    declaration.name
  ) {
    return declaration.name.text;
  }
  return undefined;
}

function isReactComponentSignature(
  signature: ts.Signature,
  declaration: ts.Declaration,
  checker: ts.TypeChecker,
): boolean {
  if (containsJsx(declaration)) return true;
  return isReactRenderableType(signature.getReturnType(), checker, new Set());
}

function containsJsx(node: ts.Node): boolean {
  let found = false;
  const visit = (candidate: ts.Node): void => {
    if (
      ts.isJsxElement(candidate) ||
      ts.isJsxFragment(candidate) ||
      ts.isJsxSelfClosingElement(candidate)
    ) {
      found = true;
      return;
    }
    if (!found) ts.forEachChild(candidate, visit);
  };
  visit(node);
  return found;
}

function isReactRenderableType(
  type: ts.Type,
  checker: ts.TypeChecker,
  seen: Set<ts.Type>,
): boolean {
  if (seen.has(type)) return false;
  seen.add(type);
  const symbol = type.aliasSymbol ?? type.getSymbol();
  const name = symbol ? resolveAlias(symbol, checker).getName() : undefined;
  if (name === "ReactNode" || name === "ReactElement" || name === "Element") return true;
  if (type.isUnionOrIntersection()) {
    return type.types.some((part) => isReactRenderableType(part, checker, new Set(seen)));
  }
  return false;
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
