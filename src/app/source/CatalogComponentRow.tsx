import { Button } from "@heroui/react";
import { Diamond } from "lucide-react";
import type { RuntimeSourceWorkspaceEntry } from "../../shared/source-workspace";
import { suggestedSourceDesignPath } from "../../shared/source-design";
import { SourceDesignStatus } from "./SourceDesignStatus";
import { type SourceCatalogComponent } from "./source-library-catalog";

export function CatalogComponentRow(props: {
  component: SourceCatalogComponent;
  selected: boolean;
  source?: { entries: readonly RuntimeSourceWorkspaceEntry[] };
  onSelect: (id: string) => void;
}) {
  return (
    <div className="relative mx-2 flex min-h-10 items-center" role="listitem">
      <Button
        aria-pressed={props.selected}
        className={`min-h-9 min-w-0 flex-1 justify-start gap-2 rounded-md px-2 pr-9 text-left text-xs ${
          props.selected
            ? "bg-purple-500 text-white hover:bg-purple-400"
            : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
        }`}
        fullWidth
        variant="ghost"
        onPress={() => props.onSelect(props.component.id)}
      >
        <Diamond className={`shrink-0 ${props.selected ? "text-white/80" : "text-violet-400/70"}`} size={12} />
        <span className="min-w-0 flex-1 truncate">{props.component.label}</span>
      </Button>
      {!props.component.entry?.design ? (
        <span className="absolute right-2">
          <SourceDesignStatus
            designPath={props.component.entry
              ? suggestedSourceDesignPath(props.component.entry, props.source?.entries ?? [])
              : "No registered source file"}
            label={props.component.label}
          />
        </span>
      ) : null}
    </div>
  );
}
