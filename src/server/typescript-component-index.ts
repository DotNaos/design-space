import { isAbsolute, join, relative, sep } from "node:path";

import ts from "typescript";

import type {
  SourceComponentProp,
  SourcePropKind,
  SourceWorkspaceLayer,
} from "../shared/source-workspace";
import { DesignSpaceError } from "./errors";
import {
  assertStillRegistered,
  canonicalRegisteredFile,
  canonicalRoot,
} from "./path-security";

export interface IndexedTypeScriptComponent {
  filePath: string;
  exportName: string;
  label: string;
  propsTypeText: string;
  props: readonly SourceComponentProp[];
  uses: readonly string[];
  layers: readonly SourceWorkspaceLayer[];
}

export interface TypeScriptComponentIndexOptions {
  projectRoot: string;
  filePaths: readonly string[];
}

interface SlotShape {
  slot: boolean;
  single: boolean;
  multiple: boolean;
}

const noSlot: SlotShape = { slot: false, single: false, multiple: false };
const singleSlot: SlotShape = { slot: true, single: true, multiple: false };
const flexibleSlot: SlotShape = { slot: true, single: true, multiple: true };
const typeFormatFlags =
  ts.TypeFormatFlags.NoTruncation |
  ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope;

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
  const program = ts.createProgram({ rootNames: filePaths, options: compilerOptions });
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

    const props = extractProps(signature, declaration, checker);
    components.push({
      exportName,
      filePath: relative(projectRoot, sourceFile.fileName).split(sep).join("/"),
      label,
      props: props.items,
      propsTypeText: props.typeText,
      uses: jsxComponentNames(declaration),
      layers: jsxLayers(declaration, localComponents, new Set([label])),
    });
  }
  return components;
}

function jsxLayers(
  declaration: ts.Declaration,
  localComponents: ReadonlyMap<string, ts.Declaration>,
  path: ReadonlySet<string>,
): readonly SourceWorkspaceLayer[] {
  const layers: SourceWorkspaceLayer[] = [];
  const visit = (node: ts.Node): void => {
    const layer = jsxLayer(node, localComponents, path);
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
): SourceWorkspaceLayer | undefined {
  if (ts.isJsxElement(node)) {
    const label = node.openingElement.tagName.getText();
    const kind = jsxLayerKind(label);
    return {
      id: `jsx:${node.getStart()}`,
      label,
      kind,
      children: [
        ...localComponentLayers(label, kind, localComponents, path),
        ...jsxChildLayers(node.children, localComponents, path),
      ],
    };
  }
  if (ts.isJsxSelfClosingElement(node)) {
    const label = node.tagName.getText();
    const kind = jsxLayerKind(label);
    return {
      id: `jsx:${node.getStart()}`,
      label,
      kind,
      children: localComponentLayers(label, kind, localComponents, path),
    };
  }
  if (ts.isJsxFragment(node)) {
    return {
      id: `jsx:${node.getStart()}`,
      label: "Fragment",
      kind: "fragment",
      children: jsxChildLayers(node.children, localComponents, path),
    };
  }
  return undefined;
}

function jsxChildLayers(
  children: ts.NodeArray<ts.JsxChild>,
  localComponents: ReadonlyMap<string, ts.Declaration>,
  path: ReadonlySet<string>,
): readonly SourceWorkspaceLayer[] {
  return children.flatMap((child) => {
    const direct = jsxLayer(child, localComponents, path);
    if (direct) return [direct];
    if (!ts.isJsxExpression(child) || !child.expression) return [];
    const nested: SourceWorkspaceLayer[] = [];
    const visit = (node: ts.Node): void => {
      const layer = jsxLayer(node, localComponents, path);
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

function localComponentLayers(
  label: string,
  kind: SourceWorkspaceLayer["kind"],
  localComponents: ReadonlyMap<string, ts.Declaration>,
  path: ReadonlySet<string>,
): readonly SourceWorkspaceLayer[] {
  if (kind !== "component" || path.has(label)) return [];
  const declaration = localComponents.get(label);
  if (!declaration) return [];
  return jsxLayers(declaration, localComponents, new Set(path).add(label));
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
  return reactSlotShape(signature.getReturnType(), checker, new Set()).slot;
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

function extractProps(
  signature: ts.Signature,
  fallbackDeclaration: ts.Declaration,
  checker: ts.TypeChecker,
): { items: SourceComponentProp[]; typeText: string } {
  const parameter = signature.parameters[0];
  if (!parameter) return { items: [], typeText: "Record<string, never>" };

  const location = parameter.valueDeclaration ?? signature.getDeclaration() ?? fallbackDeclaration;
  const propsType = checker.getTypeOfSymbolAtLocation(parameter, location);
  const items = checker.getPropertiesOfType(propsType).map((property) => {
    const declaration = property.valueDeclaration ?? property.declarations?.[0] ?? location;
    const type = checker.getTypeOfSymbolAtLocation(property, declaration);
    const slotShape = reactSlotShape(type, checker, new Set());
    const required =
      !(property.flags & ts.SymbolFlags.Optional) && !includesUndefined(type, new Set());
    const prop: SourceComponentProp = {
      kind: slotShape.slot ? "unknown" : primitiveKind(type),
      name: property.getName(),
      required,
      slot: slotShape.slot,
      type: checker.typeToString(type, declaration, typeFormatFlags),
    };
    if (slotShape.multiple) prop.multiple = true;
    return prop;
  });

  return {
    items,
    typeText: checker.typeToString(propsType, location, typeFormatFlags),
  };
}

function primitiveKind(type: ts.Type): SourcePropKind {
  const relevantTypes = type.isUnion()
    ? type.types.filter((part) => !(part.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)))
    : [type];
  if (relevantTypes.length === 0) return "unknown";
  if (relevantTypes.every((part) => Boolean(part.flags & ts.TypeFlags.StringLike))) return "string";
  if (relevantTypes.every((part) => Boolean(part.flags & ts.TypeFlags.NumberLike))) return "number";
  if (relevantTypes.every((part) => Boolean(part.flags & ts.TypeFlags.BooleanLike))) return "boolean";
  return "unknown";
}

function includesUndefined(type: ts.Type, seen: Set<ts.Type>): boolean {
  if (seen.has(type)) return false;
  seen.add(type);
  if (type.flags & ts.TypeFlags.Undefined) return true;
  return type.isUnion() && type.types.some((part) => includesUndefined(part, seen));
}

function reactSlotShape(
  type: ts.Type,
  checker: ts.TypeChecker,
  seen: Set<ts.Type | ts.Symbol>,
): SlotShape {
  if (seen.has(type)) return noSlot;
  seen.add(type);

  const knownShape = knownReactTypeShape(type.aliasSymbol ?? type.getSymbol(), checker);
  if (knownShape.slot) return knownShape;

  if (checker.isArrayType(type) || checker.isTupleType(type)) {
    const elementShapes = checker.getTypeArguments(type as ts.TypeReference)
      .map((elementType) => reactSlotShape(elementType, checker, new Set(seen)));
    return elementShapes.some((shape) => shape.slot)
      ? { slot: true, single: false, multiple: true }
      : noSlot;
  }

  if (type.isUnion()) {
    return mergeSlotShapes(
      type.types.map((part) => reactSlotShape(part, checker, new Set(seen))),
    );
  }

  const reference = type as ts.TypeReference;
  const symbolName = (type.aliasSymbol ?? type.getSymbol())?.getName();
  if (symbolName && ["Array", "Iterable", "ReadonlyArray", "ReadonlySet", "Set"].includes(symbolName)) {
    const elementShapes = checker.getTypeArguments(reference)
      .map((elementType) => reactSlotShape(elementType, checker, new Set(seen)));
    return elementShapes.some((shape) => shape.slot)
      ? { slot: true, single: false, multiple: true }
      : noSlot;
  }

  const alias = type.aliasSymbol;
  if (alias && !seen.has(alias)) {
    seen.add(alias);
    const aliasShapes = (alias.declarations ?? [])
      .filter(ts.isTypeAliasDeclaration)
      .map((declaration) => reactSlotNodeShape(declaration.type, checker, new Set(seen)));
    const merged = mergeSlotShapes(aliasShapes);
    if (merged.slot) return merged;
  }

  if (type.isClassOrInterface()) {
    return mergeSlotShapes(
      checker.getBaseTypes(type).map((baseType) =>
        reactSlotShape(baseType, checker, new Set(seen))),
    );
  }
  return noSlot;
}

function reactSlotNodeShape(
  node: ts.TypeNode,
  checker: ts.TypeChecker,
  seen: Set<ts.Type | ts.Symbol>,
): SlotShape {
  if (ts.isParenthesizedTypeNode(node) || ts.isTypeOperatorNode(node)) {
    return reactSlotNodeShape(node.type, checker, seen);
  }
  if (ts.isArrayTypeNode(node)) {
    const elementShape = reactSlotNodeShape(node.elementType, checker, seen);
    return elementShape.slot ? { slot: true, single: false, multiple: true } : noSlot;
  }
  if (ts.isTupleTypeNode(node)) {
    const elementShapes = node.elements.map((element) =>
      reactSlotNodeShape(
        ts.isNamedTupleMember(element) ? element.type : element,
        checker,
        new Set(seen),
      ));
    return elementShapes.some((shape) => shape.slot)
      ? { slot: true, single: false, multiple: true }
      : noSlot;
  }
  if (ts.isUnionTypeNode(node)) {
    return mergeSlotShapes(
      node.types.map((part) => reactSlotNodeShape(part, checker, new Set(seen))),
    );
  }
  if (!ts.isTypeReferenceNode(node)) return noSlot;

  const symbol = resolveAliasAtLocation(node.typeName, checker);
  const knownShape = knownReactTypeShape(symbol, checker);
  if (knownShape.slot) return knownShape;

  const name = symbol?.getName() ?? node.typeName.getText();
  if (["Array", "Iterable", "ReadonlyArray", "ReadonlySet", "Set"].includes(name)) {
    const elementShapes = (node.typeArguments ?? [])
      .map((argument) => reactSlotNodeShape(argument, checker, new Set(seen)));
    return elementShapes.some((shape) => shape.slot)
      ? { slot: true, single: false, multiple: true }
      : noSlot;
  }
  if (!symbol || seen.has(symbol)) return noSlot;

  seen.add(symbol);
  const aliasShapes = (symbol.declarations ?? [])
    .filter(ts.isTypeAliasDeclaration)
    .map((declaration) => reactSlotNodeShape(declaration.type, checker, new Set(seen)));
  return mergeSlotShapes(aliasShapes);
}

function knownReactTypeShape(symbol: ts.Symbol | undefined, checker: ts.TypeChecker): SlotShape {
  if (!symbol) return noSlot;
  const resolved = resolveAlias(symbol, checker);
  if (resolved.getName() === "ReactNode") return flexibleSlot;
  if (resolved.getName() === "ReactElement") return singleSlot;
  if (
    resolved.getName() === "Element" &&
    (checker.getFullyQualifiedName(resolved).includes("JSX.Element") ||
      resolved.declarations?.some(isDeclaredInJsxNamespace))
  ) {
    return singleSlot;
  }
  return noSlot;
}

function isDeclaredInJsxNamespace(declaration: ts.Declaration): boolean {
  let parent: ts.Node | undefined = declaration.parent;
  while (parent) {
    if (ts.isModuleDeclaration(parent) && parent.name.getText().replaceAll('"', "") === "JSX") {
      return true;
    }
    parent = parent.parent;
  }
  return false;
}

function mergeSlotShapes(shapes: readonly SlotShape[]): SlotShape {
  const slotShapes = shapes.filter((shape) => shape.slot);
  if (slotShapes.length === 0) return noSlot;
  return {
    slot: true,
    single: slotShapes.some((shape) => shape.single),
    multiple: slotShapes.some((shape) => shape.multiple),
  };
}

function resolveAliasAtLocation(node: ts.Node, checker: ts.TypeChecker): ts.Symbol | undefined {
  const symbol = checker.getSymbolAtLocation(node);
  return symbol ? resolveAlias(symbol, checker) : undefined;
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
