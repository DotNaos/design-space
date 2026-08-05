
import { MonitorPlay, PencilRuler } from "lucide-react";

import type { SourceWorkspaceMode } from "./source-layer-design";
import { PageButton } from "./PageButton";

export function SourceWorkspacePageNavigation(props: {
  mode: SourceWorkspaceMode;
  onChange: (mode: SourceWorkspaceMode) => void;
}) {
  return (
    <nav aria-label="Workspace pages" className="flex h-7 items-center rounded-lg bg-black/20 p-0.5">
      <PageButton active={props.mode === "design"} label="Design" onPress={() => props.onChange("design")}>
        <PencilRuler aria-hidden="true" size={13} />
      </PageButton>
      <PageButton active={props.mode === "preview"} label="Preview" onPress={() => props.onChange("preview")}>
        <MonitorPlay aria-hidden="true" size={13} />
      </PageButton>
    </nav>
  );
}
