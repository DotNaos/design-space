import { Button } from "@heroui/react";
import { Layers3, Plus } from "lucide-react";

export function EmptyDocumentRoot(props: {
  className?: string;
  documentKind: "screen" | "component";
  compact?: boolean;
  onInsert: () => void;
}) {
  const name = props.documentKind === "screen" ? "page" : "component body";
  return (
    <section
      aria-label={`Empty ${name}`}
      className={`${props.className ?? "flex"} min-h-0 min-w-0 flex-col items-center justify-center px-6 text-center`}
    >
      <span className="grid size-12 place-items-center rounded-xl border border-dashed border-white/10 text-zinc-600">
        <Layers3 aria-hidden="true" size={20} />
      </span>
      <h2 className={`${props.compact ? "mt-3 text-xs" : "mt-4 text-sm"} font-semibold text-zinc-200`}>This {name} is empty</h2>
      <p className={`mt-1 max-w-72 leading-5 text-zinc-600 ${props.compact ? "text-[10px]" : "text-xs"}`}>
        Choose a component from the catalog to create the first root layer.
      </p>
      <Button className="mt-4" size="sm" variant="primary" onPress={props.onInsert}>
        <Plus aria-hidden="true" size={14} /> Add root component
      </Button>
    </section>
  );
}
