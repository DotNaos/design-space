import { Input, Label, NumberField, TextArea, TextField } from "@heroui/react";
import { BoxSelect, Code2, Move, PaintBucket, SquareDashed, Type } from "lucide-react";

import type { SourceWorkspaceLayer } from "../../shared/source-workspace";
import { TailwindMappedControls } from "../inspector/TailwindMappedControls";
import {
  setSourceLayerDimension,
  setSourceLayerFill,
  setSourceLayerStroke,
  setSourceLayerStrokeWidth,
  setSourceLayerTextColor,
  sourceLayerPaint,
  type SourceLayerMetrics,
} from "./source-layer-design";
import type { SourceLayerClassEditor } from "./useSourceLayerClassEditor";

export function SourceLayerDesignInspector(props: {
  layer: SourceWorkspaceLayer;
  metrics?: SourceLayerMetrics;
  styleEditor?: SourceLayerClassEditor;
  onClassNamePreviewChange?: (value?: string) => void;
}) {
  const editor = props.styleEditor;
  const className = editor?.value ?? props.layer.className?.value ?? "";
  const paint = sourceLayerPaint(className);
  const editable = Boolean(editor?.editable);

  return (
    <section aria-label="Design" className="border-b border-white/10">
      <header className="flex min-h-11 items-center gap-2 border-b border-white/[0.06] px-4 text-zinc-500">
        <BoxSelect aria-hidden="true" className="text-sky-400" size={14} />
        <h3 id="source-layer-design" className="min-w-0 flex-1 truncate text-[10px] font-medium uppercase tracking-[0.14em]">Selected layer</h3>
        <code className="max-w-28 truncate font-mono text-[9px] text-zinc-500">{layerLabel(props.layer)}</code>
      </header>

      <div className="divide-y divide-white/[0.06]">
        <InspectorSection icon={Move} title="Position and size">
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
          <p className="mt-2 text-[9px] leading-4 text-zinc-600">X and Y reflect the rendered flow. Width and height write pixel utilities to this layer.</p>
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
            <p className="text-[10px] leading-4 text-zinc-600">This layer computes className in TypeScript. Open Code to preserve that expression.</p>
          </InspectorSection>
        ) : null}

        {props.layer.className && (
          <InspectorSection icon={PaintBucket} title="Colors and border">
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
              <TextArea aria-label="Static text" className="min-h-16 w-full resize-y rounded-md border border-white/10 bg-black/20 px-2.5 py-2 text-xs leading-5 text-zinc-200 outline-none" rows={2} />
            </TextField>
          </InspectorSection>
        )}

        {props.layer.className && (
          <InspectorSection accent icon={Code2} title="Generated Tailwind">
            <code
              aria-label="Generated Tailwind classes"
              className="block min-h-10 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md border border-sky-300/20 bg-sky-950/25 px-3 py-2.5 font-mono text-[10px] font-medium leading-4 text-sky-100 shadow-[inset_0_1px_0_rgba(125,211,252,0.06)]"
            >
              {className || "No utilities"}
            </code>
            {editor?.error && <p className="mt-2 text-[9px] leading-4 text-red-300">{editor.error}</p>}
          </InspectorSection>
        )}
      </div>
    </section>
  );
}

function InspectorSection(props: { accent?: boolean; children: React.ReactNode; icon: typeof Move; title: string }) {
  const Icon = props.icon;
  return (
    <section className={`px-4 py-3 ${props.accent ? "bg-sky-400/[0.035] shadow-[inset_2px_0_0_rgba(56,189,248,0.32)]" : ""}`}>
      <h4 className={`mb-2.5 flex items-center gap-1.5 text-[10px] font-medium ${props.accent ? "text-sky-200" : "text-zinc-400"}`}>
        <Icon aria-hidden="true" className={props.accent ? "text-sky-400" : "text-zinc-600"} size={12} />
        {props.title}
      </h4>
      {props.children}
    </section>
  );
}

function Metric(props: { label: string; value?: number }) {
  return (
    <div className="flex h-8 items-center gap-1 rounded-md border border-white/[0.08] bg-black/20 px-2">
      <span className="text-[9px] text-zinc-600">{props.label}</span>
      <span className="min-w-0 flex-1 truncate text-right font-mono text-[10px] text-zinc-400">{formatMetric(props.value)}</span>
    </div>
  );
}

function DimensionField(props: { disabled: boolean; label: string; value?: number; onChange: (value: number) => void }) {
  return (
    <NumberField isDisabled={props.disabled} minValue={0} value={Number.isFinite(props.value) ? Math.round(props.value!) : Number.NaN}>
      <Label className="sr-only">{props.label}</Label>
      <NumberField.Group className="flex h-8 items-center rounded-md border border-white/[0.08] bg-black/20 px-2">
        <span aria-hidden="true" className="text-[9px] text-zinc-600">{props.label}</span>
        <NumberField.Input
          aria-label={props.label}
          className="min-w-0 flex-1 bg-transparent text-right font-mono text-[10px] text-zinc-300 outline-none disabled:text-zinc-600"
          onChange={(event) => {
            const value = Number(event.currentTarget.value);
            if (Number.isFinite(value)) props.onChange(value);
          }}
        />
      </NumberField.Group>
    </NumberField>
  );
}

function PaintField(props: {
  disabled: boolean;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  trailing?: React.ReactNode;
}) {
  return (
    <div className={`grid min-h-10 items-center gap-2 py-1.5 ${props.trailing ? "grid-cols-[3.5rem_minmax(0,1fr)_4.5rem]" : "grid-cols-[3.5rem_minmax(0,1fr)]"}`}>
      <span className="text-[9px] text-zinc-500">{props.label}</span>
      <TextField isDisabled={props.disabled} value={props.value} onChange={props.onChange}>
        <Label className="sr-only">{props.label}</Label>
        <div className="flex h-8 items-center gap-2 rounded-md border border-white/[0.08] bg-black/20 px-2 focus-within:border-sky-300/30">
          <span
            aria-label={`${props.label} swatch`}
            className="size-3.5 shrink-0 rounded-sm border border-white/15 bg-[linear-gradient(135deg,transparent_45%,rgba(244,63,94,.8)_46%,rgba(244,63,94,.8)_54%,transparent_55%)]"
            role="img"
            style={tailwindColorStyle(props.value)}
          />
          <Input aria-label={props.label} className="h-full min-w-0 flex-1 bg-transparent px-0 font-mono text-[10px] text-zinc-300 outline-none" placeholder={props.placeholder} />
        </div>
      </TextField>
      <div className="min-w-0">{props.trailing}</div>
    </div>
  );
}

function tailwindColorStyle(value: string): React.CSSProperties | undefined {
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

function formatMetric(value: number | undefined): string {
  return Number.isFinite(value) ? String(Math.round(value!)) : "—";
}

function layerLabel(layer: SourceWorkspaceLayer): string {
  if (layer.kind === "html") return `<${layer.label}>`;
  if (layer.kind === "slot") return `slot:${layer.label}`;
  return layer.label;
}
