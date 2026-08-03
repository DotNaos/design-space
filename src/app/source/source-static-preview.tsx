import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { createElement, type CSSProperties } from "react";

import type { ComponentDesignDefinition, ComponentDesignPreview, ComponentDesignPreviewLength } from "../../shared/component-design";
import type { RuntimeSourceWorkspaceEntry, SourceWorkspaceLayer } from "../../shared/source-workspace";
import { PreviewBoundary } from "../PreviewBoundary";
import { SourcePreviewRuntimeContext } from "./SourcePreviewRuntime";
import type { SourceSlotScope } from "./source-slot-navigation";
import { SourceCanvasSlotMarker } from "./SourceCanvasSlotMarker";
import { SourceStructureDesign } from "./SourceStructureDesign";

export const sourceCanvasSlotPattern = "url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyOCIgaGVpZ2h0PSIyOCIgdmlld0JveD0iMCAwIDI4IDI4Ij48cGF0aCBkPSJNMTQgOXYxME05IDE0aDEwIiBmaWxsPSJub25lIiBzdHJva2U9IiNkOGI0ZmUiIHN0cm9rZS1vcGFjaXR5PSIuMTIiIHN0cm9rZS13aWR0aD0iMSIvPjwvc3ZnPg==)";
export const sourceCanvasSharedPattern = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'%3E%3Cpath d='M14 9v10M9 14h10' fill='none' stroke='%237dd3fc' stroke-opacity='.12' stroke-width='1'/%3E%3C/svg%3E\")";

export type SourcePreviewContentProps = {
  caseName: string;
  centered?: boolean;
  definition: ComponentDesignDefinition;
  entry: RuntimeSourceWorkspaceEntry;
  matrix: boolean;
  slotLayers?: readonly SourceWorkspaceLayer[];
};

export function renderStaticSourcePreviewMarkup(props: SourcePreviewContentProps): Promise<string> {
  return new Promise((resolve, reject) => {
    queueMicrotask(() => {
      const container = document.createElement("div");
      const root = createRoot(container);
      try {
        flushSync(() => root.render(<SourcePreviewContent {...props} />));
        bindRenderedSlotLayers(container, props.slotLayers);
        const markup = container.innerHTML;
        root.unmount();
        resolve(markup);
      } catch (error) {
        root.unmount();
        reject(error);
      }
    });
  });
}

export function renderStaticSourceDesignMarkup(props: {
  entry: RuntimeSourceWorkspaceEntry;
  slotLayers: readonly SourceWorkspaceLayer[];
  slotScopes?: Readonly<Record<string, SourceSlotScope>>;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    queueMicrotask(() => {
      const container = document.createElement("div");
      const root = createRoot(container);
      try {
        flushSync(() => root.render(<SourceStructureDesign entry={props.entry} slotLayers={props.slotLayers} slotScopes={props.slotScopes} />));
        const markup = container.innerHTML;
        root.unmount();
        resolve(markup);
      } catch (error) {
        root.unmount();
        reject(error);
      }
    });
  });
}

function bindRenderedSlotLayers(
  container: ParentNode,
  slotLayers: readonly SourceWorkspaceLayer[] | undefined,
): void {
  if (!slotLayers?.length) return;
  const layerIds = new Map(
    slotLayers
      .filter((layer) => layer.kind === "slot")
      .map((layer) => [layer.label, layer.id]),
  );
  for (const element of container.querySelectorAll<HTMLElement>("[data-design-space-source-slot-name]")) {
    const slotName = element.dataset.designSpaceSourceSlotName;
    const layerId = slotName ? layerIds.get(slotName) : undefined;
    if (layerId) element.dataset.designSpaceSourceLayerId = layerId;
  }
}

export function SourcePreviewContent(props: SourcePreviewContentProps) {
  const cases = propertyCases(props.entry, props.matrix);
  const content = (
    <div style={caseLayout(cases.length, props.centered && !props.definition.preview)}>
      {cases.map((propertyCase) => (
        <section key={propertyCase.label} style={caseStyle(cases.length)}>
          {cases.length > 1 ? <p style={{ margin: "0 0 8px", color: "#71717a", font: "10px/1.4 ui-monospace,monospace" }}>{propertyCase.label}</p> : null}
          <div style={caseContentStyle(cases.length, props.centered && !props.definition.preview)}>
            <span data-design-space-preview-entry-root style={{ display: "contents" }}>
              {props.definition.render(previewProps(props, propertyCase.values))}
            </span>
          </div>
        </section>
      ))}
    </div>
  );
  return (
    <PreviewBoundary resetKey={`${props.entry.id}:${props.caseName}:${props.matrix}`} errorTitle="Design preview crashed" errorMessage="Fix the colocated design or its required runtime context to recover.">
      <SourcePreviewRuntimeContext.Provider value>
        {props.definition.preview ? (
          <div style={{ alignItems: "center", display: "flex", justifyContent: "center", minHeight: "100%", width: "100%" }}>
            <div
              data-design-space-preview-environment
              style={previewEnvironmentStyle(props.definition.preview)}
            >
              {content}
            </div>
          </div>
        ) : content}
      </SourcePreviewRuntimeContext.Provider>
    </PreviewBoundary>
  );
}

function caseLayout(caseCount: number, centered?: boolean): CSSProperties {
  if (caseCount > 1) {
    return {
      display: "grid",
      gridTemplateColumns: `repeat(${Math.min(caseCount, 3)}, minmax(0, 1fr))`,
      gap: 16,
      minHeight: "100%",
      padding: 16,
    };
  }
  return centered
    ? { alignItems: "center", display: "flex", justifyContent: "center", minHeight: "100%", width: "100%" }
    : { minHeight: "100%" };
}

function caseStyle(caseCount: number): CSSProperties | undefined {
  return caseCount > 1
    ? { minWidth: 0, border: "1px solid rgba(127,127,127,.22)", borderRadius: 8, padding: 12 }
    : undefined;
}

function caseContentStyle(caseCount: number, centered?: boolean): CSSProperties | undefined {
  return caseCount > 1 && centered
    ? { alignItems: "center", display: "flex", justifyContent: "center", minHeight: 120 }
    : undefined;
}

function previewEnvironmentStyle(preview: Readonly<ComponentDesignPreview>): CSSProperties {
  return {
    alignItems: preview.layout === "center" ? "center" : undefined,
    background: preview.background,
    boxSizing: "border-box",
    display: preview.layout === "center" ? "flex" : "block",
    height: previewLength(preview.height),
    justifyContent: preview.layout === "center" ? "center" : undefined,
    minHeight: previewLength(preview.minHeight),
    overflow: "auto",
    padding: previewLength(preview.padding),
    width: previewLength(preview.width) ?? "100%",
  };
}

function previewLength(value: ComponentDesignPreviewLength | undefined): string | undefined {
  return typeof value === "number" ? `${value}px` : value;
}

function previewProps(
  props: SourcePreviewContentProps,
  propertyValues: Readonly<Record<string, boolean | number | string>>,
): Readonly<Record<string, unknown>> {
  const values: Record<string, unknown> = {
    ...props.definition.defaults,
    ...props.definition.cases[props.caseName],
    ...propertyValues,
  };
  if (!props.slotLayers?.length) return values;
  const slots = { ...asRecord(values.slots) };
  for (const layer of props.slotLayers) {
    if (!emptySlotValue(slots[layer.label])) continue;
    const contract = layer.slot?.contract ?? props.entry.slots.find((candidate) => candidate.name === layer.label);
    const marker = <SourceCanvasSlotMarker key={layer.id} label={layer.label} layerId={layer.id} />;
    slots[layer.label] = contract?.multiple ? [marker] : marker;
  }
  return { ...values, slots };
}

export function structureLayer(
  layer: SourceWorkspaceLayer,
  slotsById: ReadonlyMap<string, SourceWorkspaceLayer>,
  slotsByComponent: ReadonlyMap<string, SourceWorkspaceLayer>,
  attached: Set<string>,
  slotScopes: Readonly<Record<string, SourceSlotScope>> | undefined,
  topLevel: boolean,
): React.ReactNode {
  const slot = layer.kind === "slot" ? slotsById.get(layer.id) ?? layer : slotsByComponent.get(layer.id);
  if (slot) {
    if (attached.has(slot.id)) return null;
    attached.add(slot.id);
    return <SourceCanvasSlotMarker key={layer.id} fill={topLevel} label={slot.label} layerId={slot.id} scope={slotScopes?.[slot.id]} />;
  }
  if (layer.kind === "component") return null;
  const tag = /^[a-z][a-z0-9-]*$/.test(layer.label) ? layer.label : "div";
  const children = layer.children.map((child) => structureLayer(
    child,
    slotsById,
    slotsByComponent,
    attached,
    slotScopes,
    false,
  ));
  return createElement(tag, {
    className: layer.className?.value,
    "data-design-space-source-layer-id": layer.id,
    key: layer.id,
  }, layer.text?.value, ...children);
}

function emptySlotValue(value: unknown): boolean {
  return value === undefined || value === null || (Array.isArray(value) && value.length === 0);
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : {};
}

type PropertyCase = { label: string; values: Readonly<Record<string, boolean | number | string>> };

function propertyCases(entry: RuntimeSourceWorkspaceEntry, matrix: boolean): readonly PropertyCase[] {
  if (!matrix) return [{ label: "Current", values: {} }];
  const axes = entry.props.filter((property) => (property.values?.length ?? 0) > 1).slice(0, 2);
  if (!axes.length) return [{ label: "Current", values: {} }];
  const [rows, columns] = axes;
  return (rows?.values ?? []).flatMap((row) => (columns?.values ?? [undefined]).map((column) => ({
    label: [rows ? `${rows.name}=${String(row)}` : undefined, columns && column !== undefined ? `${columns.name}=${String(column)}` : undefined].filter(Boolean).join(" · "),
    values: {
      ...(rows ? { [rows.name]: row } : {}),
      ...(columns && column !== undefined ? { [columns.name]: column } : {}),
    },
  }))).slice(0, 18);
}
