import { Button } from "@heroui/react";
import { ArrowLeft, Code2, Component, Focus, PencilRuler } from "lucide-react";
import { ItemEditorActions } from "./ItemEditorActions";

export function ItemEditorIdentity(props: {
  componentLabel: string;
  sourceLabel?: string;
  sourceBacked?: boolean;
  mobile?: boolean;
  htmlElement?: boolean;
  onBack?: () => void;
  onEditDefinition?: () => void;
  onOpenIsolated?: () => void;
}) {
  return (
    <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-white/10 px-2.5 py-2">
      {props.mobile && props.onBack ? (
        <Button aria-label="Back to canvas" isIconOnly size="sm" variant="ghost" onPress={props.onBack}>
          <ArrowLeft size={17} />
        </Button>
      ) : (
        <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-sky-400/10 text-sky-300">
          {props.htmlElement ? <Code2 size={16} strokeWidth={1.8} /> : <Component size={16} strokeWidth={1.8} />}
        </span>
      )}

      <div className={`min-w-0 flex-1 ${props.mobile ? "text-center" : ""}`}>
        <h2 className="truncate text-[13px] font-semibold text-zinc-100">{props.componentLabel}</h2>
        <p className="mt-0.5 truncate text-[9px] text-zinc-600">
          {props.sourceLabel ?? (props.sourceBacked ? "Source-backed component" : "Composition draft")}
        </p>
      </div>

      {props.onOpenIsolated && (
        <Button aria-label="Open component in isolation" className="shrink-0" isIconOnly size="sm" variant="ghost" onPress={props.onOpenIsolated}>
          <Focus size={15} />
        </Button>
      )}
      {props.onEditDefinition ? (
        <Button className="shrink-0 gap-1.5 text-[10px]" size="sm" variant="ghost" onPress={props.onEditDefinition}>
          <PencilRuler size={14} />
          <span className={props.mobile ? "sr-only min-[430px]:not-sr-only" : ""}>Definition</span>
        </Button>
      ) : (
        <span className="w-9 shrink-0 text-center text-[9px] text-zinc-600">{props.sourceBacked ? "Source" : "Draft"}</span>
      )}
    </header>
  );
}

export { ItemEditorActions } from "./ItemEditorActions";
