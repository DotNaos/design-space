import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import type { ComponentDesignDefinition } from "../../shared/component-design";
import type { RuntimeSourceWorkspaceEntry, SourceWorkspaceLayer } from "../../shared/source-workspace";
import { PreviewBoundary } from "../PreviewBoundary";
import { SourcePreviewRuntimeContext } from "./SourcePreviewRuntime";

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

export function SourcePreviewContent(props: SourcePreviewContentProps) {
  const cases = propertyCases(props.entry, props.matrix);
  return (
    <PreviewBoundary resetKey={`${props.entry.id}:${props.caseName}:${props.matrix}`} errorTitle="Design preview crashed" errorMessage="Fix the colocated design or its required runtime context to recover.">
      <SourcePreviewRuntimeContext.Provider value>
        <div style={cases.length > 1
          ? { display: "grid", gridTemplateColumns: `repeat(${Math.min(cases.length, 3)}, minmax(0, 1fr))`, gap: 16, minHeight: "100%", padding: 16 }
          : props.centered
            ? { alignItems: "center", display: "flex", justifyContent: "center", minHeight: "100%", width: "100%" }
            : { minHeight: "100%" }}>
          {cases.map((propertyCase) => (
            <section key={propertyCase.label} style={cases.length > 1 ? { minWidth: 0, border: "1px solid rgba(127,127,127,.22)", borderRadius: 8, padding: 12 } : undefined}>
              {cases.length > 1 ? <p style={{ margin: "0 0 8px", color: "#71717a", font: "10px/1.4 ui-monospace,monospace" }}>{propertyCase.label}</p> : null}
              <div style={cases.length > 1 && props.centered ? { alignItems: "center", display: "flex", justifyContent: "center", minHeight: 120 } : undefined}>
                <span data-design-space-preview-entry-root style={{ display: "contents" }}>
                  {props.definition.render(previewProps(props, propertyCase.values))}
                </span>
              </div>
            </section>
          ))}
        </div>
      </SourcePreviewRuntimeContext.Provider>
    </PreviewBoundary>
  );
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
    if (!layer.slot || (layer.slot.validity !== "missing" && !emptySlotValue(slots[layer.label]))) continue;
    const marker = <SourceCanvasSlotMarker key={layer.id} label={layer.label} />;
    slots[layer.label] = layer.slot.contract.multiple ? [marker] : marker;
  }
  return { ...values, slots };
}

function SourceCanvasSlotMarker(props: { label: string }) {
  return (
    <span
      aria-hidden="true"
      data-design-space-source-slot-name={props.label}
      style={{
        backgroundColor: "rgba(46, 16, 70, .28)",
        backgroundImage: "linear-gradient(45deg, rgba(216, 180, 254, .055) 25%, transparent 25%, transparent 75%, rgba(216, 180, 254, .055) 75%), linear-gradient(45deg, rgba(216, 180, 254, .055) 25%, transparent 25%, transparent 75%, rgba(216, 180, 254, .055) 75%)",
        backgroundPosition: "0 0, 8px 8px",
        backgroundSize: "16px 16px",
        border: "1px solid rgba(192, 132, 252, .24)",
        boxSizing: "border-box",
        display: "block",
        minHeight: 56,
        minWidth: 96,
        width: "100%",
      }}
    />
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
