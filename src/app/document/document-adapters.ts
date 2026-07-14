import type { ComponentControl, ComponentDescriptor } from "../../shared/contracts";
import type { ComponentPropertyDraft, DesignDocument, DesignValue } from "../../shared/design-document";
import type { ComponentAdapter, TargetModule } from "../../shared/target-module";

export interface DocumentAdapterView {
  component: ComponentDescriptor;
  controls: readonly ComponentControl[];
  defaultProps: Readonly<Record<string, DesignValue>>;
  sourceFileId?: string;
  targetAdapter?: ComponentAdapter;
}

export function resolveDocumentAdapter(
  target: TargetModule,
  library: readonly DesignDocument[],
  adapterId: string,
): DocumentAdapterView | undefined {
  const targetAdapter = target.adapters.find((candidate) => candidate.component.id === adapterId);
  if (targetAdapter) {
    return {
      component: targetAdapter.component,
      controls: targetAdapter.controls ?? [],
      defaultProps: primitiveProps(targetAdapter.defaultProps),
      sourceFileId: targetAdapter.component.sourceFileId,
      targetAdapter,
    };
  }
  const authored = library.find((candidate) => candidate.kind === "component" && candidate.component?.id === adapterId);
  if (!authored?.component) return undefined;
  return {
    component: {
      id: authored.component.id,
      label: authored.component.label,
      group: authored.component.group,
      description: authored.component.description,
      slots: authored.component.slots,
    },
    controls: authored.component.properties.map(propertyToControl),
    defaultProps: Object.fromEntries(authored.component.properties.flatMap((property) => property.defaultValue === undefined
      ? []
      : [[property.prop, property.defaultValue]])),
  };
}

export function documentCatalog(
  target: TargetModule,
  library: readonly DesignDocument[],
): DocumentAdapterView[] {
  const ids = new Set<string>();
  return [
    ...target.adapters.map((adapter) => resolveDocumentAdapter(target, library, adapter.component.id)),
    ...library.flatMap((document) => document.component
      ? [resolveDocumentAdapter(target, library, document.component.id)]
      : []),
  ].flatMap((entry) => {
    if (!entry || ids.has(entry.component.id)) return [];
    ids.add(entry.component.id);
    return [entry];
  });
}

export function wouldCreateAuthoredComponentCycle(
  document: DesignDocument,
  library: readonly DesignDocument[],
  candidateAdapterId: string,
): boolean {
  if (document.kind !== "component" || !document.component) return false;
  const definitions = new Map<string, DesignDocument>();
  for (const candidate of [...library, document]) {
    if (candidate.kind === "component" && candidate.component) definitions.set(candidate.component.id, candidate);
  }
  const targetId = document.component.id;
  if (candidateAdapterId === targetId) return true;
  const visited = new Set<string>();
  const reachesTarget = (adapterId: string): boolean => {
    if (adapterId === targetId) return true;
    if (visited.has(adapterId)) return false;
    visited.add(adapterId);
    const definition = definitions.get(adapterId);
    return Boolean(definition && collectAdapterIds(definition.root).some(reachesTarget));
  };
  return reachesTarget(candidateAdapterId);
}

function collectAdapterIds(node: DesignDocument["root"]): string[] {
  return [
    node.adapterId,
    ...Object.values(node.slots).flatMap((children) => children.flatMap((child) => child.kind === "component"
      ? collectAdapterIds(child.node)
      : [])),
  ];
}

function propertyToControl(property: ComponentPropertyDraft): ComponentControl {
  const common = {
    id: property.id,
    label: property.label,
    prop: property.prop,
    section: property.section,
    description: property.description,
    required: property.required,
  };
  switch (property.kind) {
    case "text":
      return { ...common, kind: "text", multiline: property.multiline, maxLength: property.maxLength, placeholder: property.placeholder };
    case "tailwind":
      return { ...common, kind: "tailwind", presets: property.presets };
    case "boolean":
      return { ...common, kind: "boolean" };
    case "number":
      return { ...common, kind: "number", min: property.min, max: property.max, step: property.step, unit: property.unit };
    case "select":
      return {
        ...common,
        kind: "select",
        options: property.options.map((option, index) => ({ id: `${property.id}.option-${index}`, ...option })),
      };
  }
}

function primitiveProps(props: Readonly<Record<string, unknown>> | undefined): Readonly<Record<string, DesignValue>> {
  const entries: Array<[string, DesignValue]> = [];
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === null || typeof value === "string" || typeof value === "boolean") entries.push([key, value]);
    else if (typeof value === "number" && Number.isFinite(value)) entries.push([key, value]);
  }
  return Object.fromEntries(entries);
}
