import type { ComponentType } from "react";

export const designSpaceAreas = ["root", "pages", "components"] as const;
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
  slot: boolean;
  multiple?: boolean;
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
}

export interface SourceWorkspaceDeviceState {
  area: DesignSpaceArea;
  device: DesignSpaceDevice;
  path: string;
  state: "configured" | "fallback" | "missing";
  fallback?: Extract<DesignSpaceDevice, "desktop" | "mobile">;
}

export interface SourceWorkspaceManifest {
  runtime: DesignSpaceRuntime;
  sourceRoot: "src/app";
  entries: readonly SourceWorkspaceEntry[];
  devices: readonly SourceWorkspaceDeviceState[];
  library?: SourceWorkspaceLibrary;
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
}

export interface RuntimeSourceWorkspace extends Omit<SourceWorkspaceManifest, "entries"> {
  entries: readonly RuntimeSourceWorkspaceEntry[];
  /** Target-owned CSS, injected only into the isolated preview document. */
  styles: readonly string[];
}
