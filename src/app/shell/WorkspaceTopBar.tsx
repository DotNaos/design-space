import { Button } from "@heroui/react";
import { AlertTriangle, ArrowLeft, CheckCircle2, FileDiff, GitCompareArrows, LoaderCircle, Redo2, RotateCcw, Save, Shield, Undo2 } from "lucide-react";

import type { StrictUiEvidence } from "../../shared/strict-ui";
import { DesignSpaceThemeToggle } from "./DesignSpaceThemeToggle";
import { RunningTargetSwitcher, type WorkspaceSurfaceNavigation } from "./RunningTargetSwitcher";
export function WorkspaceTopBar(props: {
  targetLabel: string;
  documentLabel: string;
  focusLabel?: string;
  strictUi?: StrictUiEvidence;
  checking: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canReset: boolean;
  canStrictUi: boolean;
  canDiff: boolean;
  canSave: boolean;
  saving: boolean;
  pendingChanges?: number;
  leadingAction?: React.ReactNode;
  trailingAction?: React.ReactNode;
  showWorkspaceSwitcher?: boolean;
  surfaceNavigation?: WorkspaceSurfaceNavigation;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onStrictUi: () => void;
  onDiff: () => void;
  onSave: () => void;
  onReviewChanges?: () => void;
  onExitFocus?: () => void;
}) {
  return (
    <header className="relative flex h-12 shrink-0 items-center gap-1 border-b border-white/[0.08] bg-[#101113] px-2 lg:gap-0 lg:px-0">
      <div className="flex min-w-0 items-center gap-1.5 lg:px-2">
        {props.leadingAction}
        {props.focusLabel && props.onExitFocus && (
          <Button aria-label={`Back to ${props.documentLabel}`} className="size-9 shrink-0 lg:size-8" isIconOnly size="sm" variant="ghost" onPress={props.onExitFocus}>
            <ArrowLeft size={16} />
          </Button>
        )}
        <div className="lg:hidden"><StrictStatusButton disabled={!props.canStrictUi} evidence={props.strictUi} checking={props.checking} onPress={props.onStrictUi} /></div>
      </div>

      {props.showWorkspaceSwitcher === false ? null : (
        <div className="absolute left-1/2 w-[min(46vw,240px)] -translate-x-1/2">
          <RunningTargetSwitcher surfaceNavigation={props.surfaceNavigation} targetLabel={props.targetLabel} />
        </div>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-0.5 lg:px-3">
        <DesignSpaceThemeToggle />
        <Button aria-label="Undo" isIconOnly className="hidden size-8 text-zinc-500 hover:text-zinc-200 min-[1120px]:inline-flex" size="sm" variant="ghost" isDisabled={!props.canUndo} onPress={props.onUndo}><Undo2 size={14} /></Button>
        <Button aria-label="Redo" isIconOnly className="hidden size-8 text-zinc-500 hover:text-zinc-200 min-[1120px]:inline-flex" size="sm" variant="ghost" isDisabled={!props.canRedo} onPress={props.onRedo}><Redo2 size={14} /></Button>
        <Button aria-label="Reset document" isIconOnly className="hidden size-8 text-zinc-500 hover:text-zinc-200 min-[1120px]:inline-flex" size="sm" variant="ghost" isDisabled={!props.canReset} onPress={props.onReset}><RotateCcw size={13} /></Button>
        {props.onReviewChanges ? (
          <Button
            aria-label={`Review ${props.pendingChanges ?? 0} pending changes`}
            className={`h-8 gap-1.5 rounded-md px-2 text-[10px] ${(props.pendingChanges ?? 0) > 0 ? "bg-amber-400/10 text-amber-200 hover:bg-amber-400/15" : "text-zinc-600"}`}
            isDisabled={(props.pendingChanges ?? 0) === 0}
            size="sm"
            variant="ghost"
            onPress={props.onReviewChanges}
          >
            <GitCompareArrows aria-hidden="true" size={13} />
            <span className="min-[1120px]:hidden">{props.pendingChanges ?? 0}</span>
            <span className="hidden min-[1120px]:inline">{props.pendingChanges ?? 0} changes</span>
            {(props.pendingChanges ?? 0) > 0 ? <span className="hidden rounded bg-amber-300/10 px-1 py-0.5 text-[8px] font-semibold text-amber-300 xl:inline">Draft</span> : null}
          </Button>
        ) : (
          <>
            <Button aria-label="Prepare exact diff" isIconOnly className="size-9 lg:size-8" size="sm" variant="ghost" isDisabled={!props.canDiff} onPress={props.onDiff}><FileDiff size={15} /></Button>
            <Button aria-label={props.saving ? "Saving" : "Save"} isIconOnly className={`size-9 lg:size-8 ${props.canSave ? "bg-sky-500 text-white hover:bg-sky-400" : "bg-white/[0.04] text-zinc-600"}`} size="sm" isDisabled={!props.canSave} onPress={props.onSave}>{props.saving ? <LoaderCircle className="animate-spin" size={15} /> : <Save size={15} />}</Button>
          </>
        )}
        {props.trailingAction}
      </div>
    </header>
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
