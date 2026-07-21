import type { ComponentType, ReactNode } from "react";

import type { ComponentControl, ComponentDescriptor } from "./contracts";
import type { RuntimeSourceLibraryCatalog, RuntimeSourceWorkspace } from "./source-workspace";

export type PreviewElementAttributes = Readonly<{
  "data-design-space-instance-id": string;
  "data-design-space-parent-slot-id"?: string;
}>;

export type PreviewSlotAttributes = Readonly<{
  "data-design-space-slot-id": string;
}>;

export type PreviewHtmlAttributes = Readonly<{
  "data-design-space-html-id": string;
  className?: string;
}>;

export interface AdapterRenderContext {
  slotChildren: Readonly<Record<string, readonly ReactNode[]>>;
  previewAttributes: PreviewElementAttributes;
  slotAttributes: Readonly<Record<string, PreviewSlotAttributes>>;
  htmlAttributes: Readonly<Record<string, PreviewHtmlAttributes>>;
}

export interface ComponentAdapter<Props extends object = Record<string, unknown>> {
  component: ComponentDescriptor;
  controls?: readonly ComponentControl[];
  defaultProps?: Readonly<Props>;
  render: {
    bivarianceHack(props: Readonly<Props>, context: AdapterRenderContext): ReactNode;
  }["bivarianceHack"];
}

export type FixtureChild =
  | { kind: "text"; id: string; value: string }
  | { kind: "component"; node: ComponentFixture };

export interface ComponentFixture {
  instanceId: string;
  adapterId: string;
  label?: string;
  props?: Readonly<Record<string, unknown>>;
  slots: Readonly<Record<string, readonly FixtureChild[]>>;
}

export interface TargetFileEntry {
  id: string;
  label: string;
  kind: "file" | "directory";
  parentId?: string;
  editable?: boolean;
}

export interface TargetDocumentEntry {
  id: string;
  label: string;
  kind: "screen" | "component";
  group?: string;
}

export interface ComponentCreationRecipe {
  id: string;
  label: string;
  description?: string;
  rootAdapterId: string;
  rootSlotId: string;
}

export interface TargetPreviewRootProps {
  children: ReactNode;
}

export type TargetPreviewRoot = ComponentType<TargetPreviewRootProps>;

export interface TargetModule {
  project: {
    id: string;
    label: string;
  };
  adapters: readonly ComponentAdapter[];
  defaultAdapterId: string;
  defaultDocumentId?: string;
  defaultDocumentLabel?: string;
  documents?: readonly TargetDocumentEntry[];
  componentRecipes?: readonly ComponentCreationRecipe[];
  previewRoot?: TargetPreviewRoot;
  defaultProps?: Readonly<Record<string, unknown>>;
  defaultEditTargetId?: string;
  defaultFixture: ComponentFixture;
  files: readonly TargetFileEntry[];
  /** Present for TypeScript-first targets discovered from the fixed src/app tree. */
  sourceWorkspace?: RuntimeSourceWorkspace;
  /** Trusted native design catalogs for an attached component library. */
  sourceLibrary?: RuntimeSourceLibraryCatalog;
}
