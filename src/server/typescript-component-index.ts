import { isAbsolute, join, relative, sep } from "node:path";

import ts from "typescript";

import type {
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
import { sourceWorkspaceJsxLayerId, sourceWorkspaceLayerId } from "./source-layer-annotation";
import { extractComponentContract } from "./typescript-component-contract";
import { jsxClassName } from "./typescript-jsx-class-binding";

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
  const indexFiles = (contracts?: ReadonlyMap<string, readonly SourceComponentSlot[]>) => filePaths.flatMap((filePath) => {
    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) {
      throw new DesignSpaceError("COMPILE_ERROR", "TypeScript could not load a registered source file");
    }
    return indexSourceFile(sourceFile, checker, projectRoot, contracts);
  });
  const initial = indexFiles();
  const contracts = new Map<string, readonly SourceComponentSlot[]>();
  for (const component of initial) {
    contracts.set(component.label, component.slots);
    contracts.set(component.exportName, component.slots);
  }
  const components = indexFiles(contracts);

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
  componentContracts?: ReadonlyMap<string, readonly SourceComponentSlot[]>,
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
    const renderedDeclaration = renderedComponentDeclaration(declaration, localComponents);
    const layers = jsxLayers(
      renderedDeclaration,
      localComponents,
      new Set([label]),
      relativePath,
      new Set(contract.slots.map((slot) => slot.name)),
      checker,
      componentContracts,
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
    collectSlotUsageFindings(layers, findings);
    components.push({
      exportName,
      filePath: relativePath,
      label,
      props: contract.props,
      slots: contract.slots,
      findings,
      propsTypeText: contract.typeText,
      source: { start: renderedDeclaration.getStart(), end: renderedDeclaration.getEnd() },
      uses: jsxComponentNames(renderedDeclaration),
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
  checker: ts.TypeChecker,
  componentContracts?: ReadonlyMap<string, readonly SourceComponentSlot[]>,
): readonly SourceWorkspaceLayer[] {
  const layers: SourceWorkspaceLayer[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxElement(node) && isFragmentTag(node.openingElement.tagName.getText())) {
      node.children.forEach(visit);
      return;
    }
    if (ts.isJsxSelfClosingElement(node) && isFragmentTag(node.tagName.getText())) return;
    const layer = jsxLayer(node, localComponents, path, relativePath, slotNames, checker, componentContracts);
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
  checker: ts.TypeChecker,
  componentContracts?: ReadonlyMap<string, readonly SourceComponentSlot[]>,
): SourceWorkspaceLayer | undefined {
  if (ts.isJsxElement(node)) {
    const label = node.openingElement.tagName.getText();
    const kind = jsxLayerKind(label);
    return {
      id: sourceWorkspaceJsxLayerId(relativePath, node),
      label,
      kind,
      source: { start: node.getStart(), end: node.getEnd() },
      ...jsxClassName(node.openingElement, kind, checker),
      ...jsxStaticText(node),
      children: [
        ...componentUsageSlots(node.openingElement, componentContracts?.get(label), localComponents, path, relativePath, checker, componentContracts),
        ...localComponentLayers(label, kind, localComponents, path, relativePath, checker, componentContracts),
        ...jsxChildLayers(node.children, localComponents, path, relativePath, slotNames, checker, componentContracts),
      ],
    };
  }
  if (ts.isJsxSelfClosingElement(node)) {
    const label = node.tagName.getText();
    const kind = jsxLayerKind(label);
    return {
      id: sourceWorkspaceJsxLayerId(relativePath, node),
      label,
      kind,
      source: { start: node.getStart(), end: node.getEnd() },
      ...jsxClassName(node, kind, checker),
      children: [
        ...componentUsageSlots(node, componentContracts?.get(label), localComponents, path, relativePath, checker, componentContracts),
        ...localComponentLayers(label, kind, localComponents, path, relativePath, checker, componentContracts),
      ],
    };
  }
  return undefined;
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

function jsxChildLayers(
  children: ts.NodeArray<ts.JsxChild>,
  localComponents: ReadonlyMap<string, ts.Declaration>,
  path: ReadonlySet<string>,
  relativePath: string,
  slotNames: ReadonlySet<string>,
  checker: ts.TypeChecker,
  componentContracts?: ReadonlyMap<string, readonly SourceComponentSlot[]>,
): readonly SourceWorkspaceLayer[] {
  return children.flatMap((child) => {
    if (ts.isJsxFragment(child)) {
      return jsxChildLayers(child.children, localComponents, path, relativePath, slotNames, checker, componentContracts);
    }
    if (ts.isJsxElement(child) && isFragmentTag(child.openingElement.tagName.getText())) {
      return jsxChildLayers(child.children, localComponents, path, relativePath, slotNames, checker, componentContracts);
    }
    if (ts.isJsxSelfClosingElement(child) && isFragmentTag(child.tagName.getText())) return [];
    const slot = sourceSlotLayer(child, slotNames, relativePath);
    if (slot) return [slot];
    const direct = jsxLayer(child, localComponents, path, relativePath, slotNames, checker, componentContracts);
    if (direct) return [direct];
    if (!ts.isJsxExpression(child) || !child.expression) return [];
    const nested: SourceWorkspaceLayer[] = [];
    const visit = (node: ts.Node): void => {
      const layer = jsxLayer(node, localComponents, path, relativePath, slotNames, checker, componentContracts);
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

function componentUsageSlots(
  opening: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  contracts: readonly SourceComponentSlot[] | undefined,
  localComponents: ReadonlyMap<string, ts.Declaration>,
  path: ReadonlySet<string>,
  relativePath: string,
  checker: ts.TypeChecker,
  componentContracts?: ReadonlyMap<string, readonly SourceComponentSlot[]>,
): readonly SourceWorkspaceLayer[] {
  if (!contracts?.length) return [];
  const attribute = opening.attributes.properties.find((property): property is ts.JsxAttribute => (
    ts.isJsxAttribute(property) && property.name.getText() === "slots"
  ));
  const expression = attribute?.initializer && ts.isJsxExpression(attribute.initializer)
    ? attribute.initializer.expression
    : undefined;
  const object = expression && ts.isObjectLiteralExpression(expression) ? expression : undefined;

  return contracts.map((contract) => {
    const property = object?.properties.find((candidate): candidate is ts.PropertyAssignment => (
      ts.isPropertyAssignment(candidate) && propertyName(candidate.name) === contract.name
    ));
    const value = property?.initializer;
    const children = value
      ? slotValueLayers(value, localComponents, path, relativePath, checker, componentContracts)
      : [];
    const received = children.filter((child) => child.kind === "component").map((child) => child.label);
    const incompatible = received.some((label) => !contract.accepts.includes(label));
    const belowMinimum = received.length < contract.min;
    const atMaximum = contract.max !== undefined && received.length >= contract.max;
    const insertAt = object?.properties.end ?? opening.tagName.end;
    return {
      id: sourceWorkspaceLayerId(relativePath, property?.getStart() ?? insertAt, `slot.${contract.name}`),
      label: contract.name,
      kind: "slot" as const,
      source: property
        ? { start: property.getStart(), end: property.getEnd() }
        : { start: insertAt, end: insertAt },
      children,
      slot: {
        contract,
        received,
        validity: incompatible
          ? "incompatible" as const
          : belowMinimum
            ? "missing" as const
            : atMaximum
              ? "full" as const
              : received.length === 0
                ? "optional" as const
                : "valid" as const,
        edit: {
          kind: !attribute
            ? "missing-attribute" as const
            : !property
              ? "missing-property" as const
              : contract.multiple
                ? "list" as const
                : "single" as const,
          insertAt,
          ...(property ? { property: { start: property.getStart(), end: property.getEnd() } } : {}),
          ...(value ? { value: { start: value.getStart(), end: value.getEnd() } } : {}),
          ...(value && ts.isArrayLiteralExpression(value)
            ? { list: { start: value.elements.pos, end: value.elements.end } }
            : {}),
        },
      },
    };
  });
}

function slotValueLayers(
  value: ts.Expression,
  localComponents: ReadonlyMap<string, ts.Declaration>,
  path: ReadonlySet<string>,
  relativePath: string,
  checker: ts.TypeChecker,
  componentContracts?: ReadonlyMap<string, readonly SourceComponentSlot[]>,
): readonly SourceWorkspaceLayer[] {
  const values = ts.isArrayLiteralExpression(value) ? value.elements : [value];
  return values.flatMap((candidate) => {
    if (!ts.isExpression(candidate)) return [];
    const layer = jsxLayer(candidate, localComponents, path, relativePath, new Set(), checker, componentContracts);
    return layer ? [layer] : [];
  });
}

function propertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
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

function collectSlotUsageFindings(
  layers: readonly SourceWorkspaceLayer[],
  findings: SourceStrictUiFinding[],
): void {
  for (const layer of layers) {
    if (layer.slot?.validity === "missing") {
      findings.push({
        ruleId: "strict-ui.slot-content-missing",
        severity: "error",
        message: `Slot ${layer.label} requires at least ${layer.slot.contract.min} compatible component${layer.slot.contract.min === 1 ? "" : "s"}.`,
      });
    } else if (layer.slot?.validity === "incompatible") {
      findings.push({
        ruleId: "strict-ui.slot-content-incompatible",
        severity: "error",
        message: `Slot ${layer.label} accepts ${layer.slot.contract.accepts.join(", ")} but received ${layer.slot.received.join(", ")}.`,
      });
    }
    collectSlotUsageFindings(layer.children, findings);
  }
}

function localComponentLayers(
  label: string,
  kind: SourceWorkspaceLayer["kind"],
  localComponents: ReadonlyMap<string, ts.Declaration>,
  path: ReadonlySet<string>,
  relativePath: string,
  checker: ts.TypeChecker,
  componentContracts?: ReadonlyMap<string, readonly SourceComponentSlot[]>,
): readonly SourceWorkspaceLayer[] {
  if (kind !== "component" || path.has(label) || componentContracts?.has(label)) return [];
  const declaration = localComponents.get(label);
  if (!declaration) return [];
  return jsxLayers(declaration, localComponents, new Set(path).add(label), relativePath, new Set(), checker, componentContracts);
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

function renderedComponentDeclaration(
  declaration: ts.Declaration,
  localComponents: ReadonlyMap<string, ts.Declaration>,
): ts.Declaration {
  if (containsJsx(declaration)) return declaration;
  if (!ts.isVariableDeclaration(declaration) || !declaration.initializer) return declaration;
  let resolved: ts.Declaration | undefined;
  const visit = (node: ts.Node): void => {
    if (resolved) return;
    if (ts.isIdentifier(node)) {
      const candidate = localComponents.get(node.text);
      if (candidate && candidate !== declaration) {
        resolved = candidate;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(declaration.initializer);
  return resolved ?? declaration;
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
