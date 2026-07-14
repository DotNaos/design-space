import type { DesignComponentNode, DesignDocument } from "./design-document";
import type { ComponentAdapter, TargetModule } from "./target-module";

interface TailwindControlReference {
  kind: "text" | "tailwind" | "boolean" | "number" | "select";
  prop: string;
}

interface ResolvedTailwindAdapter {
  controls: readonly TailwindControlReference[];
  defaults: Readonly<Record<string, unknown>>;
  definition?: DesignDocument;
}

interface TemplateValues {
  definition: DesignDocument;
  publicValues: Readonly<Record<string, unknown>>;
}

export function collectDocumentTailwind(
  target: TargetModule,
  library: readonly DesignDocument[],
  root: DesignComponentNode,
): string {
  const definitions = new Map(library.flatMap((document) => (
    document.kind === "component" && document.component ? [[document.component.id, document] as const] : []
  )));
  const tokens = new Set<string>();
  visitNode(target, definitions, root, tokens, [], undefined);
  return [...tokens].join(" ");
}

function visitNode(
  target: TargetModule,
  definitions: ReadonlyMap<string, DesignDocument>,
  node: DesignComponentNode,
  tokens: Set<string>,
  authoredPath: readonly string[],
  template?: TemplateValues,
): void {
  const adapter = resolveAdapter(target, definitions, node.adapterId);
  if (!adapter) return;
  const bound = resolveBindings(node, template);
  const values = { ...adapter.defaults, ...node.props, ...bound };
  for (const control of adapter.controls) {
    const value = values[control.prop];
    if (control.kind === "tailwind" && typeof value === "string") {
      for (const token of value.trim().split(/\s+/).filter(Boolean)) tokens.add(token);
    }
  }

  if (adapter.definition?.component && !authoredPath.includes(adapter.definition.component.id)) {
    const publicValues = Object.fromEntries(adapter.definition.component.properties.map((property) => [
      property.prop,
      values[property.prop],
    ]));
    visitNode(
      target,
      definitions,
      adapter.definition.root,
      tokens,
      [...authoredPath, adapter.definition.component.id],
      { definition: adapter.definition, publicValues },
    );
  }

  for (const children of Object.values(node.slots)) {
    for (const child of children) {
      if (child.kind === "component") visitNode(target, definitions, child.node, tokens, authoredPath, template);
    }
  }
}

function resolveAdapter(
  target: TargetModule,
  definitions: ReadonlyMap<string, DesignDocument>,
  adapterId: string,
): ResolvedTailwindAdapter | undefined {
  const targetAdapter: ComponentAdapter | undefined = target.adapters.find((candidate) => candidate.component.id === adapterId);
  if (targetAdapter) {
    return { controls: targetAdapter.controls ?? [], defaults: targetAdapter.defaultProps ?? {} };
  }
  const definition = definitions.get(adapterId);
  if (!definition?.component) return undefined;
  return {
    controls: definition.component.properties,
    defaults: Object.fromEntries(definition.component.properties.flatMap((property) => (
      property.defaultValue === undefined ? [] : [[property.prop, property.defaultValue]]
    ))),
    definition,
  };
}

function resolveBindings(
  node: DesignComponentNode,
  template?: TemplateValues,
): Readonly<Record<string, unknown>> {
  if (!template?.definition.component) return {};
  const properties = new Map(template.definition.component.properties.map((property) => [property.id, property]));
  return Object.fromEntries(Object.entries(node.propertyBindings ?? {}).flatMap(([targetProp, propertyId]) => {
    const property = properties.get(propertyId);
    return property ? [[targetProp, template.publicValues[property.prop]]] : [];
  }));
}
