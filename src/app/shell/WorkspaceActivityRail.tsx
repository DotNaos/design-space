
import { AppWindow, FileCode2, Image, Library, Wrench } from "lucide-react";

import type { StrictUiEvidence } from "../../shared/strict-ui";
import { RailButton } from "./RailButton";
import { StrictRailButton } from "./StrictRailButton";

export type WorkspaceActivity = "app" | "library" | "files";

export function WorkspaceActivityRail(props: {
  active: WorkspaceActivity;
  strictUi?: StrictUiEvidence;
  strictUiChecking: boolean;
  canStrictUi: boolean;
  onApp: () => void;
  onLibrary: () => void;
  onFiles: () => void;
  onStrictUi: () => void;
}) {
  return (
    <nav aria-label="Workspace areas" className="hidden h-full w-[52px] shrink-0 flex-col items-center border-r border-white/10 bg-[#101113] py-2 lg:flex">
      <RailButton active={props.active === "app"} label="App" onPress={props.onApp}><AppWindow size={18} /></RailButton>
      <RailButton active={props.active === "library"} label="Library" onPress={props.onLibrary}><Library size={18} /></RailButton>
      <RailButton active={props.active === "files"} label="Files" onPress={props.onFiles}><FileCode2 size={18} /></RailButton>
      <RailButton disabled label="Assets — not registered by this target"><Image size={18} /></RailButton>

      <div className="mt-auto flex flex-col items-center gap-1 border-t border-white/10 pt-2">
        <StrictRailButton {...props} />
        <RailButton disabled label="Tools — not registered by this target"><Wrench size={18} /></RailButton>
      </div>
    </nav>
  );
}
