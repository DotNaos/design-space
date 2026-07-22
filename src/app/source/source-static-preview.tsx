import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import type { ComponentDesignDefinition } from "../../shared/component-design";
import type { RuntimeSourceWorkspaceEntry } from "../../shared/source-workspace";
import { PreviewBoundary } from "../PreviewBoundary";
import { SourcePreviewRuntimeContext } from "./SourcePreviewRuntime";

export type SourcePreviewContentProps = {
  caseName: string;
  centered?: boolean;
  definition: ComponentDesignDefinition;
  entry: RuntimeSourceWorkspaceEntry;
  matrix: boolean;
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
                  {props.definition.render({
                    ...props.definition.defaults,
                    ...props.definition.cases[props.caseName],
                    ...propertyCase.values,
                  })}
                </span>
              </div>
            </section>
          ))}
        </div>
      </SourcePreviewRuntimeContext.Provider>
    </PreviewBoundary>
  );
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
