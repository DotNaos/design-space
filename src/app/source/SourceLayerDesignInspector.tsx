import { Label, TextArea, TextField } from "@heroui/react";
import { BoxSelect, Code2, Move, PaintBucket, SquareDashed, Type } from "lucide-react";

import type { SourceWorkspaceLayer } from "../../shared/source-workspace";
import { TailwindClassField } from "../inspector/TailwindClassField";
import { TailwindMappedControls } from "../inspector/TailwindMappedControls";
import { setSourceLayerDimension, setSourceLayerFill, setSourceLayerStroke, setSourceLayerStrokeWidth, setSourceLayerTextColor, sourceLayerPaint, type SourceLayerMetrics } from "./source-layer-design";
import type { SourceLayerClassEditor } from "./useSourceLayerClassEditor";
import { InspectorSection } from "./InspectorSection";
import { Metric } from "./Metric";
import { DimensionField } from "./DimensionField";
import { PaintField } from "./PaintField";

export function SourceLayerDesignInspector(props: {
  layer: SourceWorkspaceLayer;
  metrics?: SourceLayerMetrics;
  previewClassName?: string;
  styleEditor?: SourceLayerClassEditor;
  onClassNamePreviewChange?: (value?: string) => void;
}) {
  const editor = props.styleEditor;
  const className = editor?.value ?? props.layer.className?.value ?? "";
  const paint = sourceLayerPaint(className);
  const editable = Boolean(editor?.editable);

  return (
    <section aria-label="Design" className="border-b border-white/10">
      <header className="flex h-9 items-center gap-2 border-b border-white/[0.06] px-4 text-zinc-500">
        <BoxSelect aria-hidden="true" className="text-sky-400" size={14} />
        <h3 aria-label="Selected layer" id="source-layer-design" className="min-w-0 flex-1 truncate text-[10px] font-medium">Layer</h3>
        <code className="max-w-28 truncate font-mono text-[9px] text-zinc-500">{layerLabel(props.layer)}</code>
      </header>

      <div className="divide-y divide-white/[0.06]">
        <InspectorSection icon={Move} title="Frame">
          <div className="grid grid-cols-4 gap-1.5">
            <Metric label="X" value={props.metrics?.x} />
            <Metric label="Y" value={props.metrics?.y} />
            <DimensionField
              disabled={!editable}
              label="W"
              value={props.metrics?.width}
              onChange={(value) => editor?.change(setSourceLayerDimension(className, "width", value))}
            />
            <DimensionField
              disabled={!editable}
              label="H"
              value={props.metrics?.height}
              onChange={(value) => editor?.change(setSourceLayerDimension(className, "height", value))}
            />
          </div>
        </InspectorSection>

        {props.layer.className ? (
          <div className="px-4 py-1">
            <TailwindMappedControls
              value={className}
              onChange={(value) => editor?.change(value)}
              onPreviewChange={props.onClassNamePreviewChange}
            />
          </div>
        ) : props.layer.classNameDynamic ? (
          <InspectorSection icon={SquareDashed} title="Layout">
            <p className="text-[10px] text-zinc-600">Computed in code</p>
          </InspectorSection>
        ) : null}

        {props.layer.className && (
          <InspectorSection icon={PaintBucket} title="Paint">
            <div className="divide-y divide-white/[0.05]">
              <PaintField
                disabled={!editable}
                label="Fill"
                placeholder="none"
                value={paint.fill}
                onChange={(value) => editor?.change(setSourceLayerFill(className, value))}
              />
              <PaintField
                disabled={!editable}
                label="Stroke"
                placeholder="none"
                value={paint.stroke}
                onChange={(value) => editor?.change(setSourceLayerStroke(className, value))}
                trailing={(
                  <DimensionField
                    disabled={!editable}
                    label="px"
                    value={paint.strokeWidth}
                    onChange={(value) => editor?.change(setSourceLayerStrokeWidth(className, value))}
                  />
                )}
              />
              <PaintField
                disabled={!editable}
                label="Text"
                placeholder="inherit"
                value={paint.textColor}
                onChange={(value) => editor?.change(setSourceLayerTextColor(className, value))}
              />
            </div>
          </InspectorSection>
        )}

        {props.layer.text && (
          <InspectorSection icon={Type} title="Content">
            <TextField fullWidth isDisabled={!editor?.textEditable} value={editor?.textValue ?? props.layer.text.value} onChange={(value) => editor?.changeText(value)}>
              <Label className="sr-only">Static text</Label>
              <TextArea aria-label="Static text" className="min-h-16 w-full resize-y rounded-lg border-0 bg-black/20 px-2.5 py-2 text-xs leading-5 text-zinc-200 outline-none focus:ring-1 focus:ring-sky-400/50" rows={2} />
            </TextField>
          </InspectorSection>
        )}

        {props.layer.className && (
          <InspectorSection icon={Code2} title="Classes">
            <TailwindClassField
              compileError={editor?.error}
              disabled={!editable}
              label="className"
              previewValue={props.previewClassName}
              value={className}
              onChange={(value) => {
                props.onClassNamePreviewChange?.();
                editor?.change(value);
              }}
            />
          </InspectorSection>
        )}
      </div>
    </section>
  );
}

export function tailwindColorStyle(value: string): React.CSSProperties | undefined {
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (validCssColor(normalized)) return { background: normalized };
  const match = normalized.match(/^([a-z]+(?:-\d{2,3})?)(?:\/(?:\[(\d*\.?\d+)\]|(\d{1,3})))?$/);
  if (!match) return undefined;
  const opacity = match[2] !== undefined
    ? Math.max(0, Math.min(1, Number(match[2]))) * 100
    : match[3] !== undefined
      ? Math.max(0, Math.min(100, Number(match[3])))
      : 100;
  return {
    background: opacity === 100
      ? `var(--color-${match[1]})`
      : `color-mix(in srgb, var(--color-${match[1]}) ${opacity}%, transparent)`,
  };
}

function validCssColor(value: string): boolean {
  return /^(?:#|(?:rgb|hsl|oklch|color|var)\()/.test(value);
}

export function formatMetric(value: number | undefined): string {
  return Number.isFinite(value) ? String(Math.round(value!)) : "—";
}

function layerLabel(layer: SourceWorkspaceLayer): string {
  if (layer.kind === "html") return `<${layer.label}>`;
  if (layer.kind === "slot") return `slot:${layer.label}`;
  return layer.label;
}
