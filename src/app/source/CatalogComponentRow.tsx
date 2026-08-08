import { Button } from "@heroui/react";
import { Diamond } from "lucide-react";
import type { RuntimeSourceWorkspaceEntry } from "../../shared/source-workspace";
import { suggestedSourceDesignPath } from "../../shared/source-design";
import { SourceDesignStatus } from "./SourceDesignStatus";
import { type SourceCatalogComponent } from "./source-library-catalog";

export function CatalogComponentRow(props: {
  component: SourceCatalogComponent;
  depth?: number;
  selected: boolean;
  source?: { entries: readonly RuntimeSourceWorkspaceEntry[] };
  onSelect: (id: string) => void;
}) {
  return (
    <div
      className="relative mx-2.5 flex min-h-10 items-center"
      role="listitem"
      style={{ paddingLeft: (props.depth ?? 0) * 14 }}
    >
      <Button
        aria-label={props.component.path.join(" / ")}
        aria-pressed={props.selected}
        className={`min-h-9 min-w-0 flex-1 justify-start gap-2 rounded-full px-3.5 pr-10 text-left text-xs transition-colors ${
          props.selected
            ? "bg-violet-500/[0.14] text-violet-200 hover:bg-violet-500/[0.2] hover:text-violet-100"
            : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
        }`}
        fullWidth
        variant="ghost"
        onPress={() => props.onSelect(props.component.id)}
      >
        <Diamond className={`shrink-0 ${props.selected ? "text-violet-300" : "text-violet-400/70"}`} size={12} />
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
