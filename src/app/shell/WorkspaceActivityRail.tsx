import { Button, Tooltip } from "@heroui/react";
import { AppWindow, FileCode2, Image, Library, Shield, ShieldCheck, ShieldX, Wrench } from "lucide-react";

import type { StrictUiEvidence } from "../../shared/strict-ui";

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

function RailButton(props: {
  active?: boolean;
  children: React.ReactNode;
  disabled?: boolean;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Tooltip delay={250}>
      <Button
        aria-current={props.active ? "page" : undefined}
        aria-label={props.label}
        className={`relative size-10 min-w-10 rounded-xl transition-colors ${props.active ? "bg-sky-500 text-white shadow-[0_8px_24px_rgba(14,165,233,0.24)]" : "text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200"}`}
        isDisabled={props.disabled}
        isIconOnly
        size="sm"
        variant="ghost"
        onPress={props.onPress}
      >
        {props.children}
      </Button>
      <Tooltip.Content placement="right" showArrow>{props.label}</Tooltip.Content>
    </Tooltip>
  );
}

function StrictRailButton(props: {
  strictUi?: StrictUiEvidence;
  strictUiChecking: boolean;
  canStrictUi: boolean;
  onStrictUi: () => void;
}) {
  const label = props.strictUiChecking ? "Strict UI checking" : props.strictUi ? `Strict UI ${props.strictUi.status}` : "Strict UI not checked";
  const Icon = props.strictUi?.status === "passed" ? ShieldCheck : props.strictUi?.status === "blocked" ? ShieldX : Shield;
  const tone = props.strictUi?.status === "passed" ? "text-emerald-400" : props.strictUi?.status === "blocked" ? "text-rose-400" : props.strictUi?.status === "warnings" ? "text-amber-400" : undefined;
  return <RailButton label={label} disabled={!props.canStrictUi} onPress={props.onStrictUi}><Icon className={tone} size={18} /></RailButton>;
}
