import { FileCode2 } from "lucide-react";

import { MobileAreaButton } from "./MobileAreaButton";

export type SourceWorkspaceActivity = "app" | "files" | "library";

export function SourceWorkspaceAreaTabs(props: {
  activity: SourceWorkspaceActivity;
  label?: string;
  returnActivity: Exclude<SourceWorkspaceActivity, "files">;
  onActivityChange: (activity: SourceWorkspaceActivity) => void;
}) {
  return (
    <nav
      aria-label={props.label ?? "Workspace areas"}
      className="flex shrink-0 items-center rounded-full bg-black/20 p-0.5"
    >
      <MobileAreaButton
        active={props.activity === "files"}
        label="Files"
        onPress={() => props.onActivityChange(props.activity === "files" ? props.returnActivity : "files")}
      >
        <FileCode2 size={14} />
      </MobileAreaButton>
    </nav>
  );
}
