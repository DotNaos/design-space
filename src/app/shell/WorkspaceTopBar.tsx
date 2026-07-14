import { Button } from "@heroui/react";
import { AlertTriangle, CheckCircle2, FileDiff, LoaderCircle, Redo2, RotateCcw, Save, Shield, Undo2 } from "lucide-react";

import type { StrictUiEvidence } from "../../shared/strict-ui";
import type { ProductMode } from "../documents/DocumentNavigator";

export function WorkspaceTopBar(props: {
  targetLabel: string;
  documentLabel: string;
  mode: ProductMode;
  connected: boolean;
  strictUi?: StrictUiEvidence;
  checking: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canReset: boolean;
  canStrictUi: boolean;
  canDiff: boolean;
  canSave: boolean;
  saving: boolean;
  onModeChange: (mode: ProductMode) => void;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onStrictUi: () => void;
  onDiff: () => void;
  onSave: () => void;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-1 border-b border-white/10 bg-[#101113] px-2 lg:h-14 lg:gap-3 lg:px-3">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 lg:flex-initial lg:gap-2">
        <div className="min-w-0 max-w-36 lg:max-w-60">
          <span className="hidden truncate text-[9px] font-medium uppercase tracking-[0.12em] text-zinc-600 lg:block">{props.targetLabel}</span>
          <span className="block truncate text-sm font-semibold tracking-tight text-zinc-100">{props.documentLabel}</span>
        </div>
        <ConnectionStatus connected={props.connected} />
        <StrictStatusButton disabled={!props.canStrictUi} evidence={props.strictUi} checking={props.checking} onPress={props.onStrictUi} />
      </div>

      <div aria-label="Workspace mode" className="mx-auto hidden items-center rounded-lg bg-black/20 p-1 lg:flex">
        <Button size="sm" variant={props.mode === "app" ? "secondary" : "ghost"} onPress={() => props.onModeChange("app")}>App</Button>
        <Button size="sm" variant={props.mode === "library" ? "secondary" : "ghost"} onPress={() => props.onModeChange("library")}>Library</Button>
      </div>

      <div className="ml-auto flex shrink-0 items-center lg:gap-1">
        <Button aria-label="Undo" isIconOnly className="size-9 lg:size-8" size="sm" variant="ghost" isDisabled={!props.canUndo} onPress={props.onUndo}><Undo2 size={15} /></Button>
        <Button aria-label="Redo" isIconOnly className="size-9 lg:size-8" size="sm" variant="ghost" isDisabled={!props.canRedo} onPress={props.onRedo}><Redo2 size={15} /></Button>
        <Button aria-label="Reset document" isIconOnly className="size-9 lg:size-8" size="sm" variant="ghost" isDisabled={!props.canReset} onPress={props.onReset}><RotateCcw size={14} /></Button>
        <Button aria-label="Prepare exact diff" isIconOnly className="size-9 lg:size-8" size="sm" variant="ghost" isDisabled={!props.canDiff} onPress={props.onDiff}><FileDiff size={15} /></Button>
        <Button aria-label={props.saving ? "Saving" : "Save"} isIconOnly className="size-9 bg-sky-500 text-white hover:bg-sky-400 lg:size-8" size="sm" isDisabled={!props.canSave} onPress={props.onSave}>{props.saving ? <LoaderCircle className="animate-spin" size={15} /> : <Save size={15} />}</Button>
      </div>
    </header>
  );
}

function ConnectionStatus({ connected }: { connected: boolean }) {
  const label = connected ? "Local preview connected" : "Local preview disconnected";
  return (
    <span aria-label={label} className="flex shrink-0 items-center gap-1.5 text-[10px] text-zinc-500" role="status">
      <span aria-hidden="true" className={`size-1.5 rounded-full ${connected ? "bg-cyan-400" : "bg-zinc-600"}`} />
      <span className="hidden xl:inline">{connected ? "Connected" : "Offline"}</span>
    </span>
  );
}

function StrictStatusButton(props: { disabled: boolean; evidence?: StrictUiEvidence; checking: boolean; onPress: () => void }) {
  const label = props.checking ? "Strict UI checking" : props.evidence ? `Strict UI ${props.evidence.status}` : "Strict UI not checked";
  const icon = props.checking
    ? <LoaderCircle className="animate-spin" size={14} />
    : props.evidence?.status === "passed"
      ? <CheckCircle2 size={14} />
      : props.evidence?.status === "blocked" || props.evidence?.status === "warnings"
        ? <AlertTriangle size={14} />
        : <Shield size={14} />;
  const tone = props.evidence?.status === "passed" ? "text-emerald-400" : props.evidence?.status === "blocked" ? "text-rose-400" : props.evidence?.status === "warnings" ? "text-amber-400" : "text-zinc-600";
  return <Button aria-label={label} className={`size-9 shrink-0 ${tone}`} isDisabled={props.disabled} isIconOnly size="sm" variant="ghost" onPress={props.onPress}>{icon}</Button>;
}
