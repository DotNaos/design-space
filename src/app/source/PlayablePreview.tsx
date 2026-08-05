import { useLayoutEffect, useRef } from "react";
import type { RuntimeSourceWorkspaceEntry, SourceWorkspaceLayer } from "../../shared/source-workspace";
import type { ComponentDesignDefinition } from "../../shared/component-design";
import { SourcePreviewContent } from "./source-static-preview";
import { applySourceLayerClassNameById, applySourceLayerTextById } from "./SourcePreviewFrame";

export function PlayablePreview(props: {
  caseName: string;
  centered?: boolean;
  classCss?: string;
  className?: string;
  definition: ComponentDesignDefinition;
  entry: RuntimeSourceWorkspaceEntry;
  layer?: SourceWorkspaceLayer;
  matrix: boolean;
  styles: readonly string[];
  text?: string;
}) {
  const output = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = output.current;
    if (!root || !props.layer) return;
    if (props.className !== undefined) applySourceLayerClassNameById(root, props.layer.id, props.className);
    if (props.text !== undefined) applySourceLayerTextById(root, props.layer.id, props.text);
  }, [props.className, props.layer, props.text]);
  return (
    <section aria-label={`${props.entry.label} interactive preview`} className="h-full w-full overflow-auto bg-[#0d0e10] text-zinc-100">
      <style>{[props.styles.join("\n"), props.classCss ?? ""].join("\n")}</style>
      <div ref={output} className="min-h-full">
        <SourcePreviewContent caseName={props.caseName} centered={props.centered} definition={props.definition} entry={props.entry} matrix={props.matrix} />
      </div>
    </section>
  );
}
