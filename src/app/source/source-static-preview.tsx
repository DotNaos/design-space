import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { CSSProperties } from "react";

import type {
  ComponentDesignDefinition,
  ComponentDesignPreview,
  ComponentDesignPreviewLength,
} from "../../shared/component-design";
import type { RuntimeSourceWorkspaceEntry, SourceWorkspaceLayer } from "../../shared/source-workspace";
import { PreviewBoundary } from "../PreviewBoundary";
import { SourcePreviewRuntimeContext } from "./SourcePreviewRuntime";

const sourceCanvasSlotPattern = "url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyOCIgaGVpZ2h0PSIyOCIgdmlld0JveD0iMCAwIDI4IDI4Ij48cGF0aCBkPSJNMTQgOXYxME05IDE0aDEwIiBmaWxsPSJub25lIiBzdHJva2U9IiNkOGI0ZmUiIHN0cm9rZS1vcGFjaXR5PSIuMTIiIHN0cm9rZS13aWR0aD0iMSIvPjwvc3ZnPg==)";

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

function SourceCanvasSlotMarker(props: { label: string; layerId: string }) {
  return (
    <span
      aria-label={`${props.label} slot`}
      data-design-space-source-layer-id={props.layerId}
      data-design-space-source-slot-name={props.label}
      role="region"
      style={{
        alignItems: "center",
        backgroundColor: "rgba(88, 28, 135, .16)",
        backgroundImage: sourceCanvasSlotPattern,
        backgroundPosition: "0 0",
        backgroundSize: "28px 28px",
        border: "1px solid rgba(192, 132, 252, .38)",
        borderRadius: 10,
        boxSizing: "border-box",
        color: "#c4b5fd",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        justifyContent: "center",
        minHeight: "clamp(64px, 18vh, 144px)",
        minWidth: 96,
        padding: 12,
        width: "100%",
      }}
    >
      <strong style={{ font: "600 12px/1.4 ui-monospace, SFMono-Regular, monospace" }}>{props.label}</strong>
      <span style={{ color: "#71717a", font: "10px/1.4 ui-sans-serif, system-ui, sans-serif" }}>Empty slot</span>
    </span>
  );
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
