import type { ReactNode } from "react";

import type { ComponentDescriptor } from "./contracts";

export interface AdapterRenderContext {
  slotChildren: Readonly<Record<string, readonly ReactNode[]>>;
}

export interface ComponentAdapter<Props extends object = Record<string, unknown>> {
  component: ComponentDescriptor;
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
