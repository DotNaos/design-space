import { Input, Label, NumberField, TextArea, TextField } from "@heroui/react";
import { BoxSelect, Move, PaintBucket, SquareDashed, Type } from "lucide-react";

import type { SourceWorkspaceLayer } from "../../shared/source-workspace";
import { TailwindMappedControls } from "../inspector/TailwindMappedControls";
import { TailwindClassField } from "../inspector/TailwindClassField";
import {
  setSourceLayerDimension,
  setSourceLayerFill,
  setSourceLayerStroke,
  setSourceLayerStrokeWidth,
  sourceLayerPaint,
  type SourceLayerMetrics,
} from "./source-layer-design";
import type { SourceLayerClassEditor } from "./useSourceLayerClassEditor";

export function SourceLayerDesignInspector(props: {
  layer: SourceWorkspaceLayer;
  metrics?: SourceLayerMetrics;
  styleEditor?: SourceLayerClassEditor;
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
            <TailwindMappedControls value={className} onChange={(value) => editor?.change(value)} />
          </div>
        ) : props.layer.classNameDynamic ? (
          <InspectorSection icon={SquareDashed} title="Layout">
            <p className="text-[10px] leading-4 text-zinc-600">This layer computes className in TypeScript. Open Code to preserve that expression.</p>
          </InspectorSection>
        ) : null}

        {props.layer.className && (
          <InspectorSection icon={PaintBucket} title="Fill and stroke">
            <div className="grid grid-cols-2 gap-2">
              <PaintField
                disabled={!editable}
                label="Fill"
                placeholder="#141518"
                value={paint.fill}
                onChange={(value) => editor?.change(setSourceLayerFill(className, value))}
              />
              <PaintField
                disabled={!editable}
                label="Stroke"
                placeholder="#ffffff"
                value={paint.stroke}
                onChange={(value) => editor?.change(setSourceLayerStroke(className, value))}
              />
            </div>
            <div className="mt-2 w-1/2 pr-1">
              <DimensionField
                disabled={!editable}
                label="Stroke px"
                value={paint.strokeWidth}
                onChange={(value) => editor?.change(setSourceLayerStrokeWidth(className, value))}
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
          <details className="group px-4 py-2">
            <summary className="cursor-pointer list-none py-1 text-[9px] text-zinc-600 hover:text-zinc-400">Advanced Tailwind classes</summary>
            <div className="pb-3 pt-2">
              <TailwindClassField compileError={editor?.error} disabled={!editable} label="Tailwind classes" value={className} onChange={(value) => editor?.change(value)} />
            </div>
          </details>
        )}
      </div>
    </section>
  );
}

function InspectorSection(props: { children: React.ReactNode; icon: typeof Move; title: string }) {
  const Icon = props.icon;
  return (
    <section className="px-4 py-3">
      <h4 className="mb-2.5 flex items-center gap-1.5 text-[10px] font-medium text-zinc-400"><Icon aria-hidden="true" className="text-zinc-600" size={12} />{props.title}</h4>
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

function PaintField(props: { disabled: boolean; label: string; placeholder: string; value: string; onChange: (value: string) => void }) {
  return (
    <TextField isDisabled={props.disabled} value={props.value} onChange={props.onChange}>
      <Label className="mb-1 block text-[9px] text-zinc-600">{props.label}</Label>
      <Input aria-label={props.label} className="h-8 w-full rounded-md border border-white/[0.08] bg-black/20 px-2 font-mono text-[10px] text-zinc-300 outline-none" placeholder={props.placeholder} />
    </TextField>
  );
}

function formatMetric(value: number | undefined): string {
  return Number.isFinite(value) ? String(Math.round(value!)) : "—";
}

function layerLabel(layer: SourceWorkspaceLayer): string {
  if (layer.kind === "html") return `<${layer.label}>`;
  if (layer.kind === "slot") return `slot:${layer.label}`;
  return layer.label;
}
