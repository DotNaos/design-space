import type { DesignChild, DesignComponentNode, DesignDocument } from "./design-document";
import type { TargetModule } from "./target-module";

interface TailwindControlReference {
  kind: "text" | "tailwind" | "boolean" | "number" | "select";
  prop: string;
}

interface TailwindTemplateContext {
  definition: DesignDocument;
  publicValues: Readonly<Record<string, unknown>>;
  externalSlots: DesignComponentNode["slots"];
  externalContext?: TailwindTemplateContext;
  callerAuthoredPath: readonly string[];
}

export function collectDocumentTailwind(
  target: TargetModule,
  library: readonly DesignDocument[],
  documentOrRoot: DesignDocument | DesignComponentNode,
): string {
  const definitions = new Map(library.flatMap((document) => (
    document.kind === "component" && document.component ? [[document.component.id, document] as const] : []
  )));
  const tokens = new Set<string>();
  if (isDesignDocument(documentOrRoot) && !documentOrRoot.root) return "";
  if (isDesignDocument(documentOrRoot) && documentOrRoot.kind === "component" && documentOrRoot.component) {
    const publicValues = componentDefaults(documentOrRoot);
    collectTailwindValues(documentOrRoot.component.properties, publicValues, tokens);
    visitNode(target, definitions, documentOrRoot.root!, tokens, [documentOrRoot.component.id], {
      definition: documentOrRoot,
      publicValues,
      externalSlots: emptySlots(documentOrRoot),
      callerAuthoredPath: [],
    });
  } else {
    const root = isDesignDocument(documentOrRoot) ? documentOrRoot.root! : documentOrRoot;
    visitNode(target, definitions, root, tokens, [], undefined);
  }
  return [...tokens].join(" ");
}

function visitNode(
  target: TargetModule,
  definitions: ReadonlyMap<string, DesignDocument>,
  node: DesignComponentNode,
  tokens: Set<string>,
  authoredPath: readonly string[],
  templateContext: TailwindTemplateContext | undefined,
): void {
  collectClassNames(node.htmlClassNames, tokens);
  const bound = resolveBindings(node, templateContext);
  const targetAdapter = target.adapters.find((candidate) => candidate.component.id === node.adapterId);
  if (targetAdapter) {
    const values = { ...targetAdapter.defaultProps, ...node.props, ...bound };
    collectTailwindValues(targetAdapter.controls ?? [], values, tokens);
    visitSlots(target, definitions, node, tokens, authoredPath, templateContext);
    return;
  }

  const definition = definitions.get(node.adapterId);
  if (!definition?.component || !definition.root) return;
  if (authoredPath.includes(definition.component.id)) return;
  const publicValues = { ...componentDefaults(definition), ...node.props, ...bound };
  collectTailwindValues(definition.component.properties, publicValues, tokens);
  visitNode(
    target,
    definitions,
    definition.root,
    tokens,
    [...authoredPath, definition.component.id],
    {
      definition,
      publicValues,
      externalSlots: node.slots,
      externalContext: templateContext,
      callerAuthoredPath: authoredPath,
    },
  );
}

function collectClassNames(values: Readonly<Record<string, string>> | undefined, tokens: Set<string>): void {
  for (const value of Object.values(values ?? {})) {
    for (const token of value.trim().split(/\s+/).filter(Boolean)) tokens.add(token);
  }
}

function visitSlots(
  target: TargetModule,
  definitions: ReadonlyMap<string, DesignDocument>,
  node: DesignComponentNode,
  tokens: Set<string>,
  authoredPath: readonly string[],
  templateContext: TailwindTemplateContext | undefined,
): void {
  for (const children of Object.values(node.slots)) {
    for (const child of children) {
      visitChild(target, definitions, child, tokens, authoredPath, templateContext);
    }
  }
}

function visitChild(
  target: TargetModule,
  definitions: ReadonlyMap<string, DesignDocument>,
  child: DesignChild,
  tokens: Set<string>,
  authoredPath: readonly string[],
  templateContext: TailwindTemplateContext | undefined,
): void {
  if (child.kind === "component") {
    visitNode(target, definitions, child.node, tokens, authoredPath, templateContext);
    return;
  }
  if (child.kind !== "slot-outlet" || !templateContext) return;
  for (const projected of templateContext.externalSlots[child.slotId] ?? []) {
    visitChild(
      target,
      definitions,
      projected,
      tokens,
      templateContext.callerAuthoredPath,
      templateContext.externalContext,
    );
  }
}

function collectTailwindValues(
  controls: readonly TailwindControlReference[],
  values: Readonly<Record<string, unknown>>,
  tokens: Set<string>,
): void {
  for (const control of controls) {
    const value = values[control.prop];
    if (control.kind !== "tailwind" || typeof value !== "string") continue;
    for (const token of value.trim().split(/\s+/).filter(Boolean)) tokens.add(token);
  }
}

function componentDefaults(document: DesignDocument): Readonly<Record<string, unknown>> {
  return Object.fromEntries((document.component?.properties ?? []).flatMap((property) => (
    property.defaultValue === undefined ? [] : [[property.prop, property.defaultValue]]
  )));
}

function emptySlots(document: DesignDocument): DesignComponentNode["slots"] {
  return Object.fromEntries((document.component?.slots ?? []).map((slot) => [slot.id, []]));
}

function isDesignDocument(value: DesignDocument | DesignComponentNode): value is DesignDocument {
  return "schemaVersion" in value;
}

function resolveBindings(
  node: DesignComponentNode,
  templateContext: TailwindTemplateContext | undefined,
): Readonly<Record<string, unknown>> {
  if (!templateContext?.definition.component) return {};
  const properties = new Map(templateContext.definition.component.properties.map((property) => [property.id, property]));
  return Object.fromEntries(Object.entries(node.propertyBindings ?? {}).flatMap(([targetProp, propertyId]) => {
    const property = properties.get(propertyId);
    if (!property) return [];
    const value = templateContext.publicValues[property.prop];
    return value === undefined ? [] : [[targetProp, value]];
  }));
}
