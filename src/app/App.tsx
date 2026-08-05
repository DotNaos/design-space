
import target from "virtual:design-space-target";
import { type SelectionTarget } from "../model";
import type { ComponentFixture } from "../shared/target-module";
import { WorkspaceShell, WorkspaceStatus } from "./components/WorkspaceShell";
import { createTargetViewModel, type TargetViewModel } from "./target-model";
import { DocumentWorkspace } from "./DocumentWorkspace";
import { SourceWorkspace } from "./SourceWorkspace";
import { useSourcePreviewRuntime } from "./source/SourcePreviewRuntime";
import { usesDocumentWorkspace } from "./workspace-selection";
import { LegacyWorkspace } from "./LegacyWorkspace";

export const initialVersion = "0".repeat(64);
export type TargetResult = { view: TargetViewModel; error?: never } | { view?: never; error: string };
export type SlotSelection = Extract<SelectionTarget, { kind: "slot" }>;
export type FixtureUndo = { fixture: ComponentFixture; compositionCss: Readonly<Record<string, string>>; undoRootEdit: boolean };

export function App() {
  const previewRuntime = useSourcePreviewRuntime();
  if (target.sourceWorkspace) {
    return <WorkspaceShell slots={{
      status: <WorkspaceStatus />,
      content: <SourceWorkspace nestedPreview={previewRuntime} target={target} />,
    }} />;
  }
  if (usesDocumentWorkspace(target)) {
    return <WorkspaceShell slots={{
      status: <WorkspaceStatus />,
      content: <DocumentWorkspace target={target} />,
    }} />;
  }
  return <WorkspaceShell slots={{
    status: <WorkspaceStatus />,
    content: <LegacyWorkspace />,
  }} />;
}

export function initialSelection(result: TargetResult): SelectionTarget {
  if (result.view) return result.view.slots.find((slot) => !slot.occupied)?.selection ?? { kind: "component", id: result.view.root.instanceId };
  return { kind: "component", id: "unavailable" };
}

export function safeInitialView(): TargetResult {
  try { return { view: createTargetViewModel(target, false) } as const; }
  catch (error) { return { error: error instanceof Error ? error.message : "The target adapter is invalid." } as const; }
}

export function getInitialClassName() {
  const fixtureClass = target.defaultFixture?.props?.className;
  return typeof fixtureClass === "string" ? fixtureClass : typeof target.defaultProps?.className === "string" ? target.defaultProps.className : "";
}

export function statusLabel(phase: string, dirty: boolean, connected: boolean, compositionDraft: boolean) {
  if (!connected) return "Connecting to the registered local target";
  if (phase === "stale") return "Source changed outside Design Space · Reset to reload";
  if (phase === "compile-error") return "Preview error · edit or Reset to recover";
  if (phase === "saved") return "Saved locally";
  if (compositionDraft) return "Composition preview draft · target fixture unchanged";
  if (dirty) return "Live draft · source unchanged";
  return "Saved source · no unsaved changes";
}

export function messageFor(error: unknown) {
  return error instanceof Error ? error.message : "The local operation failed.";
}

export function isMobileWorkspace() {
  return window.matchMedia("(max-width: 1023px)").matches;
}

export { LegacyWorkspace } from "./LegacyWorkspace";
