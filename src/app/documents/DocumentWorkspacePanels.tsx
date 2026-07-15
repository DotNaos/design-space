import type { ReactNode } from "react";

import type { ComponentTreeRow, SelectionTarget } from "../../model";
import type { StrictUiViolation } from "../../shared/strict-ui";
import type { TargetDocumentEntry, TargetFileEntry } from "../../shared/target-module";
import type { CanvasContextMenuRequest } from "../components/PreviewCanvas";
import { ComponentTree } from "../components/ComponentTree";
import { PreviewCanvas } from "../components/PreviewCanvas";
import type { CatalogEntry } from "../components/CatalogPanel";
import { SlotCatalogPanel } from "../components/SlotCatalogPanel";
import type { DocumentAdapterView } from "../document/document-adapters";
import type { SelectionNavigationCommand } from "../document/selection-navigation";
import type { MobilePane } from "../shell/MobileDock";
import type { SlotState } from "../types";
import { EmptyModeState } from "./EmptyModeState";
import type { ProductMode } from "./DocumentNavigator";
import { DocumentWorkspaceSurface } from "./DocumentWorkspaceSurface";
import { WorkspaceBrowser, type WorkspaceBrowserView } from "./WorkspaceBrowser";
import { WorkspaceSidebar, type WorkspaceSidebarView } from "./WorkspaceSidebar";
import { SlotInspector } from "../inspector/SlotInspector";

type SlotSelection = Extract<SelectionTarget, { kind: "slot" }>;

export function DocumentWorkspacePanels(props: {
  projectId: string;
  documentId: string;
  documentLabel: string;
  documentKind: "screen" | "component";
  mode: ProductMode;
  mobilePane: MobilePane;
  mobileEditorOpen?: boolean;
  sidebarView: WorkspaceSidebarView;
  browserView: WorkspaceBrowserView;
  modeDocumentAvailable: boolean;
  canCreate: boolean;
  entries: readonly TargetDocumentEntry[];
  files: readonly TargetFileEntry[];
  catalog: readonly DocumentAdapterView[];
  activeDocumentId?: string;
  selectedCatalogId?: string;
  requestedFileId?: string;
  rows: readonly ComponentTreeRow[];
  selection: SelectionTarget;
  hoveredSelection?: SelectionTarget;
  highlightedInternalHtmlComponentId?: string;
  showInternals: boolean;
  insertMode: boolean;
  strictUiViolations: readonly StrictUiViolation[];
  preview: ReactNode;
  canvasRootId: string;
  canvasSelectedId: string;
  canvasSelection: SelectionTarget;
  canvasSelectionLabel: string;
  canvasSlots: readonly SlotState[];
  selectedSlot?: SlotState;
  slotPicker?: SlotSelection;
  pickerLabel: string;
  pickerEntries: readonly CatalogEntry[];
  actionMessage?: string;
  slotDependencyMessage?: string;
  rightOverride?: ReactNode;
  desktopEditor: ReactNode;
  mobileDefinition: ReactNode;
  onBrowserViewChange: (view: WorkspaceBrowserView) => void;
  onSidebarViewChange: (view: WorkspaceSidebarView) => void;
  onModeChange: (mode: ProductMode) => void;
  onDocumentSelect: (id: string) => void;
  onFileOpened: () => void;
  onCatalogSelect: (id: string) => void;
  onCreate: () => void;
  onSelect: (selection: SelectionTarget) => void;
  onCanvasSelect?: (selection: SelectionTarget) => void;
  onHover: (selection: SelectionTarget | undefined) => void;
  onHoverInternals: (componentInstanceId: string | undefined) => void;
  onNavigate: (command: SelectionNavigationCommand) => void;
  onCollapseAll: () => void;
  onToggleInsert: () => void;
  onToggleInternals: (componentInstanceId?: string) => void;
  onOpenSlot: (slot: SlotSelection) => void;
  onClearSlot: (slot: SlotSelection) => void;
  onRemoveOutlet: (id: string) => void;
  onRemoveSlotDefinition?: () => void;
  onClosePicker: () => void;
  onInsertComponent: (id: string) => void;
  onContextMenu: (request: CanvasContextMenuRequest) => void;
  onEditComponent: (id: string) => void;
  onDomSnapshot: (snapshot: import("../dom/dom-snapshot").PreviewDomSnapshot) => void;
  onMobileDrawerClose: () => void;
}) {
  const slotSelection = props.selection.kind === "slot" ? props.selection : undefined;
  const outletSelection = props.selection.kind === "slot-outlet" ? props.selection : undefined;
  const empty = <EmptyModeState className="flex h-full w-full" mode={props.mode} canCreate={props.canCreate} onCreate={props.onCreate} />;
  const projectBrowser = (showViewNavigation: boolean) => (
    <WorkspaceBrowser
      className="flex h-full w-full border-r-0"
      view={props.browserView}
      mode={props.mode}
      entries={props.entries}
      files={props.files}
      catalogEntries={props.catalog}
      activeDocumentId={props.modeDocumentAvailable ? props.activeDocumentId : undefined}
      selectedComponentId={props.selectedCatalogId}
      requestedFileId={props.requestedFileId}
      canCreate={props.canCreate}
      showViewNavigation={showViewNavigation}
      onViewChange={props.onBrowserViewChange}
      onModeChange={props.onModeChange}
      onDocumentSelect={props.onDocumentSelect}
      onFileSelect={props.onFileOpened}
      onCatalogSelect={props.onCatalogSelect}
      onCreate={props.onCreate}
    />
  );
  const componentTree = props.modeDocumentAvailable ? (
    <ComponentTree
      className="flex h-full w-full border-r-0"
      pageLabel={props.documentLabel}
      rows={props.rows}
      selectedId={props.selection.id}
      showInternals={props.showInternals}
      insertMode={props.insertMode}
      prompt={props.insertMode ? "Choose a slot with room, then pick a compatible component." : undefined}
      toggleLabel={props.documentKind === "component" ? "Show implementation" : undefined}
      toggleHint={props.documentKind === "component" ? "Public slots stay visible while internals collapse" : undefined}
      strictUiViolations={props.strictUiViolations}
      onHover={props.onHover}
      onHoverInternals={props.onHoverInternals}
      onContextMenuRequest={(selection, position) => props.onContextMenu({
        selection,
        clientPosition: position,
        viewportPosition: position,
      })}
      onInsert={props.onToggleInsert}
      onSelect={props.onSelect}
      onCollapseAll={props.onCollapseAll}
      onToggleInternals={props.onToggleInternals}
    />
  ) : empty;
  const canvas = props.modeDocumentAvailable ? (
    <div className="relative flex min-h-0 min-w-0 flex-1">
      <PreviewCanvas
        cameraKey={props.documentId}
        preview={props.preview}
        rootInstanceId={props.canvasRootId}
        selectedComponentInstanceId={props.canvasSelectedId}
        selection={props.canvasSelection}
        selectionLabel={props.canvasSelectionLabel}
        slots={props.canvasSlots}
        hoveredSelection={props.hoveredSelection}
        highlightedInternalHtmlComponentId={props.highlightedInternalHtmlComponentId}
        strictUiViolations={props.strictUiViolations}
        onContextMenuRequest={props.onContextMenu}
        onEditComponent={props.onEditComponent}
        onDomSnapshot={props.onDomSnapshot}
        onSelect={props.onCanvasSelect ?? props.onSelect}
        onNavigate={props.onNavigate}
      />
      {props.actionMessage && (
        <p aria-live="polite" className="pointer-events-none absolute bottom-3 left-3 z-30 max-w-[min(28rem,calc(100%-1.5rem))] rounded-lg border border-amber-400/20 bg-[#17181b]/95 px-3 py-2 text-[10px] leading-4 text-amber-100 shadow-xl">
          {props.actionMessage}
        </p>
      )}
    </div>
  ) : <div className="flex min-h-0 min-w-0 flex-1">{empty}</div>;
  const slotInspector = props.modeDocumentAvailable && props.selectedSlot ? (
    <SlotInspector
      className="flex h-full w-full"
      slot={props.selectedSlot}
      authoredDefinition={props.selection.kind === "slot-outlet"}
      dependencyMessage={props.slotDependencyMessage ?? props.actionMessage}
      onInsert={slotSelection ? () => props.onOpenSlot(slotSelection) : undefined}
      onClear={slotSelection ? () => props.onClearSlot(slotSelection) : undefined}
      onRemoveOutlet={outletSelection ? () => props.onRemoveOutlet(outletSelection.outletId) : undefined}
      onRemoveDefinition={outletSelection ? props.onRemoveSlotDefinition : undefined}
    />
  ) : undefined;
  const right = props.slotPicker ? (
    <SlotCatalogPanel
      className="flex h-full w-full"
      slotLabel={props.pickerLabel}
      entries={props.pickerEntries}
      onClose={props.onClosePicker}
      onSelect={props.onInsertComponent}
    />
  ) : props.rightOverride ?? slotInspector ?? props.desktopEditor;
  const left = (
    <WorkspaceSidebar active={props.sidebarView} onChange={props.onSidebarViewChange}>
      {props.sidebarView === "tree" ? componentTree : projectBrowser(false)}
    </WorkspaceSidebar>
  );
  return (
    <DocumentWorkspaceSurface
      projectId={props.projectId}
      documentId={props.documentId}
      mobilePane={props.mobilePane}
      mobileEditorOpen={props.mobileEditorOpen}
      left={left}
      canvas={canvas}
      right={right}
      mobileProject={projectBrowser(true)}
      mobileTree={componentTree}
      mobileInspect={slotInspector ?? props.mobileDefinition}
      onMobileDrawerClose={props.onMobileDrawerClose}
    />
  );
}
