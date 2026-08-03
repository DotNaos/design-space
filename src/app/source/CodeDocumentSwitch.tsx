import { Button } from "@heroui/react";

export function CodeDocumentSwitch(props: {
  value: "source" | "design";
  onChange: (value: "source" | "design") => void;
}) {
  return (
    <div aria-label="Code file" className="flex shrink-0 items-center rounded-md bg-white/[0.04] p-0.5" role="group">
      <Button
        aria-pressed={props.value === "source"}
        className={`h-5 min-w-0 rounded px-1.5 text-[9px] ${props.value === "source" ? "bg-white/10 text-zinc-200" : "text-zinc-600"}`}
        size="sm"
        variant="ghost"
        onPress={() => props.onChange("source")}
      >
        Source
      </Button>
      <Button
        aria-pressed={props.value === "design"}
        className={`h-5 min-w-0 rounded px-1.5 text-[9px] ${props.value === "design" ? "bg-white/10 text-zinc-200" : "text-zinc-600"}`}
        size="sm"
        variant="ghost"
        onPress={() => props.onChange("design")}
      >
        Design file
      </Button>
    </div>
  );
}
