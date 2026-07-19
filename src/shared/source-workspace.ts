import type { ComponentType } from "react";

import type { ComponentDesignDefinition } from "./component-design";

export const designSpaceAreas = ["layout", "pages", "components"] as const;
export const designSpaceDevices = ["desktop", "tablet", "mobile"] as const;

export type DesignSpaceArea = (typeof designSpaceAreas)[number];
export type DesignSpaceDevice = (typeof designSpaceDevices)[number];
export type DesignSpaceRuntime = "react" | "react-native";

export interface DesignSpaceProjectConfig {
  project: {
    id: string;
    label: string;
  };
  /** Web is the default. React Native targets use their own project root and config. */
  runtime?: DesignSpaceRuntime;
  /** Tablet may intentionally reuse one existing implementation. */
  tablet?: {
    fallback: Extract<DesignSpaceDevice, "desktop" | "mobile">;
  };
  /** Existing responsive apps may explicitly declare one shared implementation. */
  devices?: {
    mode: "responsive";
  };
  /** Optional target-owned app preview entry inside the trusted src tree. */
  source?: {
    layout: string;
  };
}

/** Keeps .designspace.ts type-safe without introducing a generated manifest. */
export function defineDesignSpace<const Config extends DesignSpaceProjectConfig>(config: Config): Config {
  return config;
}

export type SourcePropKind = "boolean" | "number" | "string" | "unknown";

export interface SourceComponentProp {
  name: string;
  type: string;
  required: boolean;
  kind: SourcePropKind;
  /** Compiler-derived finite values that can form a property matrix axis. */
  values?: readonly (boolean | number | string)[];
}

export interface SourceComponentDesign {
  fileId: string;
  relativePath: string;
}

export interface SourceComponentSlot {
  name: string;
  type: string;
  required: boolean;
  multiple: boolean;
  accepts: readonly string[];
  min: number;
  max?: number;
}

export interface SourceStrictUiFinding {
  ruleId:
    | "strict-ui.children-forbidden"
    | "strict-ui.invalid-slot-contract"
    | "strict-ui.slot-not-rendered"
    | "strict-ui.slot-content-missing"
    | "strict-ui.slot-content-incompatible";
  severity: "error";
  message: string;
}

export interface SourceWorkspaceEntry {
  id: string;
  label: string;
  area: DesignSpaceArea;
  device: DesignSpaceDevice;
  fileId: string;
  relativePath: string;
  exportName: string;
  props: readonly SourceComponentProp[];
  slots: readonly SourceComponentSlot[];
  findings: readonly SourceStrictUiFinding[];
  source: SourceLayerBinding;
  /** React component names referenced by this export's JSX. */
  uses?: readonly string[];
  /** JSX structure authored inside this export, including intrinsic HTML. */
  layers?: readonly SourceWorkspaceLayer[];
  previewable?: boolean;
  /** Colocated executable preview evidence. Missing means the component is not previewable. */
  design?: SourceComponentDesign;
}

export interface SourceWorkspaceLayer {
  id: string;
  label: string;
  kind: "component" | "html" | "slot";
  children: readonly SourceWorkspaceLayer[];
  source: SourceLayerBinding;
  /** Exact source binding for a static or currently absent JSX className. */
  className?: SourceLayerClassNameBinding;
  /** Dynamic className expressions stay code-only until their expression can be preserved. */
  classNameDynamic?: true;
  /** Exact source binding for one direct static JSX text child. */
  text?: SourceLayerTextBinding;
  /** Compiler-derived slot state for a component use. Present only on slot nodes. */
  slot?: SourceSlotUsage;
}

export type SourceSlotValidity = "valid" | "missing" | "incompatible" | "full" | "optional";

export interface SourceSlotUsage {
  contract: SourceComponentSlot;
  validity: SourceSlotValidity;
  received: readonly string[];
  edit: SourceSlotEditBinding;
}

export interface SourceSlotEditBinding {
  kind: "missing-attribute" | "missing-property" | "single" | "list";
  insertAt: number;
  property?: SourceLayerBinding;
  value?: SourceLayerBinding;
  list?: SourceLayerBinding;
}

export interface SourceLayerBinding {
  start: number;
  end: number;
}

export interface SourceLayerClassNameBinding {
  value: string;
  start: number;
  end: number;
  insert?: true;
  syntax?: "attribute" | "expression";
}

export interface SourceLayerTextBinding {
  value: string;
  start: number;
  end: number;
  syntax: "expression" | "text";
}

export interface SourceWorkspaceDeviceState {
  area: DesignSpaceArea;
  device: DesignSpaceDevice;
  path: string;
  state: "configured" | "fallback" | "missing" | "responsive";
  fallback?: Extract<DesignSpaceDevice, "desktop" | "mobile">;
}

export interface SourceWorkspaceManifest {
  runtime: DesignSpaceRuntime;
  sourceRoot: string;
  entries: readonly SourceWorkspaceEntry[];
  devices: readonly SourceWorkspaceDeviceState[];
  library?: SourceWorkspaceLibrary;
  capabilities?: {
    createComponents: boolean;
  };
}

export interface SourceWorkspaceLibrary {
  packageName: string;
  version: string;
  mode: "development" | "release";
  editable: boolean;
  components: readonly SourceLibraryComponent[];
}

export interface SourceLibraryComponent {
  name: string;
  evidence: "package-export" | "project-import";
}

export interface RuntimeSourceWorkspaceEntry extends SourceWorkspaceEntry {
  component: ComponentType<Record<string, unknown>>;
  design?: SourceComponentDesign & {
    load: () => Promise<ComponentDesignDefinition>;
  };
}

export interface RuntimeSourceWorkspace extends Omit<SourceWorkspaceManifest, "entries"> {
  entries: readonly RuntimeSourceWorkspaceEntry[];
  /** Target-owned CSS, injected only into the isolated preview document. */
  styles: readonly string[];
}
