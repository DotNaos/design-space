import type { ReactNode } from "react";

import type { ComponentControl, ComponentDescriptor } from "./contracts";

export type PreviewElementAttributes = Readonly<{
  "data-design-space-instance-id": string;
  "data-design-space-parent-slot-id"?: string;
}>;

export type PreviewSlotAttributes = Readonly<{
  "data-design-space-slot-id": string;
}>;

export interface AdapterRenderContext {
  slotChildren: Readonly<Record<string, readonly ReactNode[]>>;
  previewAttributes: PreviewElementAttributes;
  slotAttributes: Readonly<Record<string, PreviewSlotAttributes>>;
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
}

export interface TargetModule {
  project: {
    id: string;
    label: string;
  };
  adapters: readonly ComponentAdapter[];
  defaultAdapterId: string;
  defaultProps?: Readonly<Record<string, unknown>>;
  defaultEditTargetId?: string;
  defaultFixture: ComponentFixture;
  files: readonly TargetFileEntry[];
}
