import { ArrowLeft, FileCode2 } from "lucide-react";

import { MobileAreaButton } from "./MobileAreaButton";

export type SourceWorkspaceActivity = "app" | "files" | "library";

export function SourceWorkspaceAreaTabs(props: {
  activity: SourceWorkspaceActivity;
  label?: string;
  returnActivity: Exclude<SourceWorkspaceActivity, "files">;
  onActivityChange: (activity: SourceWorkspaceActivity) => void;
}) {
  const filesActive = props.activity === "files";
  const label = filesActive ? `Back to ${props.returnActivity === "library" ? "Library" : "App"}` : "Files";
  return (
    <nav
      aria-label={props.label ?? "Workspace areas"}
      className="flex shrink-0 items-center rounded-full bg-black/20 p-0.5"
    >
      <MobileAreaButton
        active={filesActive}
        label={label}
        onPress={() => props.onActivityChange(filesActive ? props.returnActivity : "files")}
      >
        {filesActive ? <ArrowLeft size={14} /> : <FileCode2 size={14} />}
      </MobileAreaButton>
    </nav>
  );
}
