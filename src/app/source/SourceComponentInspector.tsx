import { Braces, Component, FileCode2 } from "lucide-react";

import type {
  SourceComponentProp,
  SourceWorkspaceEntry,
  SourceWorkspaceLayer,
} from "../../shared/source-workspace";
import { TailwindClassField } from "../inspector/TailwindClassField";
import type { SourceLayerClassEditor } from "./useSourceLayerClassEditor";

export interface SourceComponentInspectorProps {
  className?: string;
  entry?: SourceWorkspaceEntry;
  layer?: SourceWorkspaceLayer;
  styleEditor?: SourceLayerClassEditor;
}

export function SourceComponentInspector(props: SourceComponentInspectorProps) {
  if (!props.entry) {
    return (
      <aside
        aria-label="TypeScript component contract"
        className={`${props.className ?? "flex w-72"} min-h-0 min-w-0 shrink-0 items-center justify-center border-l border-white/10 bg-[#141518] px-6 text-center`}
      >
        <p className="text-xs leading-5 text-zinc-600">Select an exported component to inspect its TypeScript contract.</p>
      </aside>
    );
  }

  const regularProps = props.entry.props.filter((property) => !property.slot);
  const slots = props.entry.props.filter((property) => property.slot);

  return (
    <aside
      aria-label="TypeScript component contract"
      className={`${props.className ?? "flex w-72"} min-h-0 min-w-0 shrink-0 flex-col border-l border-white/10 bg-[#141518]`}
    >
      <header className="shrink-0 border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <FileCode2 aria-hidden="true" className="shrink-0 text-sky-400" size={15} />
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-100">{props.entry.label}</h2>
        </div>
        <p className="mt-1 truncate text-[10px] text-zinc-600" title={props.entry.relativePath}>{props.entry.relativePath}</p>
        <p className="mt-0.5 text-[9px] text-zinc-700">Export: {props.entry.exportName}</p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {props.layer?.kind === "html" && (
          <LayerDesignSection layer={props.layer} styleEditor={props.styleEditor} />
        )}
        <ContractSection
          emptyMessage="No non-slot props are declared."
          icon={<Braces aria-hidden="true" size={14} />}
          properties={regularProps}
          title="Props"
        />
        <ContractSection
          emptyMessage="No slot props are declared."
          icon={<Component aria-hidden="true" size={14} />}
          properties={slots}
          title="Slots"
        />
      </div>
    </aside>
  );
}

function LayerDesignSection(props: {
  layer: SourceWorkspaceLayer;
  styleEditor?: SourceLayerClassEditor;
}) {
  const editor = props.styleEditor;
  return (
    <section aria-labelledby="source-layer-design" className="border-b border-white/10 px-4 pb-4">
      <header className="flex min-h-10 items-center gap-2 text-zinc-500">
        <Braces aria-hidden="true" size={14} />
        <h3 id="source-layer-design" className="text-[10px] font-medium uppercase tracking-[0.14em]">Design</h3>
        <code className="ml-auto font-mono text-[9px] text-zinc-700">&lt;{props.layer.label}&gt;</code>
      </header>
      {props.layer.className ? (
        <>
          <TailwindClassField
            compileError={editor?.error}
            disabled={!editor?.editable}
            label="Tailwind classes"
            value={editor?.value ?? props.layer.className.value}
            onChange={(value) => editor?.change(value)}
          />
          <p className="mt-2 text-[9px] leading-4 text-zinc-600">
            Changes are applied to this element only. Review the exact source diff before saving.
          </p>
        </>
      ) : (
        <p className="text-[10px] leading-4 text-zinc-600">
          This element computes className in TypeScript. Open its code to preserve that expression.
        </p>
      )}
    </section>
  );
}

function ContractSection(props: {
  emptyMessage: string;
  icon: React.ReactNode;
  properties: readonly SourceComponentProp[];
  title: "Props" | "Slots";
}) {
  return (
    <section aria-labelledby={`source-contract-${props.title.toLowerCase()}`} className="border-b border-white/10">
      <header className="flex min-h-10 items-center gap-2 px-4 text-zinc-500">
        {props.icon}
        <h3 id={`source-contract-${props.title.toLowerCase()}`} className="text-[10px] font-medium uppercase tracking-[0.14em]">
          {props.title}
        </h3>
        <span className="ml-auto text-[9px] tabular-nums text-zinc-700">{props.properties.length}</span>
      </header>
      {props.properties.length ? (
        <dl>
          {props.properties.map((property) => <ContractProperty key={property.name} property={property} />)}
        </dl>
      ) : (
        <p className="px-4 pb-4 text-[10px] leading-4 text-zinc-600">{props.emptyMessage}</p>
      )}
    </section>
  );
}

function ContractProperty(props: { property: SourceComponentProp }) {
  return (
    <div className="border-t border-white/[0.06] px-4 py-3">
      <dt className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-zinc-300">{props.property.name}</span>
        {props.property.multiple && (
          <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[8px] uppercase tracking-wide text-zinc-500">Multiple</span>
        )}
        <span className={`text-[9px] font-medium ${props.property.required ? "text-amber-300" : "text-zinc-600"}`}>
          {props.property.required ? "Required" : "Optional"}
        </span>
      </dt>
      <dd className="mt-1.5">
        <code className="block whitespace-pre-wrap break-words font-mono text-[10px] leading-4 text-sky-300/80">
          {props.property.type}
        </code>
      </dd>
    </div>
  );
}
