import type { ComponentType } from "react";

import type { ComponentDesignDefinition } from "./component-design";

export const designSpaceAreas = ["layout", "pages", "components"] as const;
export const designSpaceDevices = ["desktop", "tablet", "mobile"] as const;

export type DesignSpaceArea = (typeof designSpaceAreas)[number];
export type DesignSpaceDevice = (typeof designSpaceDevices)[number];
export type DesignSpaceRuntime = "react" | "react-native" | "electron";

export interface DesignSpaceLibraryProjectConfig {
  /** Trusted Git remote used when the independent library project is not cloned yet. */
  repository: string;
  /** Directory name below the shared projects directory. */
  checkoutName: string;
  /** Package directory inside each checkout or worktree. */
  packageRoot: string;
}

export interface DesignSpaceProjectConfig {
  project: {
    id: string;
    label: string;
  };
  /** Web is the default. React Native targets use their own project root and config. */
  runtime?: Exclude<DesignSpaceRuntime, "electron">;
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
  /** Optional trusted component-library lifecycle owned by the local Design Space server. */
  library?: {
    package: string;
    /** Optional independent-project lifecycle for selecting and attaching development worktrees. */
    project?: DesignSpaceLibraryProjectConfig;
    development?: {
      /** Absolute or project-relative directory containing the library package. */
      root: string;
    };
  };
  /**
   * Optional server-owned cryptographic approval verification.
   * The external trust root is intentionally supplied through
   * PROJECT_APPROVAL_TRUST_ROOT, never through browser state or this repository.
   */
  approvals?: {
    /** Project-relative policy path. Defaults to .project/approvals/policy.yaml. */
    policy?: string;
  };
}

export interface LibraryDevelopmentWorktree {
  id: string;
  branch: string;
  path: string;
  head: string;
  packageReady: boolean;
  active: boolean;
}

export interface LibraryDevelopmentProjectStatus {
  configured: boolean;
  repository?: string;
  checkoutPath?: string;
  cloned: boolean;
  state: "stopped" | "running";
  activeWorktreeId?: string;
  /** Local branches, including branches that have not been materialized as worktrees yet. */
  branches?: readonly string[];
  worktrees: readonly LibraryDevelopmentWorktree[];
}

export interface LibraryReleaseVersion {
  version: string;
  publishedAt?: string;
  deprecated?: string;
}

export interface LibraryReleaseStatus {
  packageName: string;
  currentVersion?: string;
  requestedVersion?: string;
  latestVersion?: string;
  versions: readonly LibraryReleaseVersion[];
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
  /** Present only for app.manifest.json projects. */
  targetId?: string;
  /** Explicit manifest devices that use this implementation. */
  manifestDevices?: readonly DesignSpaceDevice[];
}

export type SourceApprovalState = "approved" | "missing" | "stale" | "invalid";

export interface SourceComponentApproval {
  scopeId: string;
  label: string;
  state: SourceApprovalState;
  attestation: string;
  reason?: string;
}

export interface SourceApprovalEvidence {
  status: "verified" | "not-configured" | "unavailable";
  policyId?: string;
  reason?: string;
  components: Readonly<Record<string, SourceComponentApproval>>;
}

export interface SourceWorkspaceLayer {
  id: string;
  label: string;
  kind: "component" | "html" | "slot";
  children: readonly SourceWorkspaceLayer[];
  source: SourceLayerBinding;
  /** Compiler-resolved component export referenced by this JSX layer. */
  component?: SourceWorkspaceComponentReference;
  /** Definition of a same-file component referenced by this JSX layer. */
  definition?: SourceLayerBinding;
  /** Exact source binding for a static or currently absent JSX className. */
  className?: SourceLayerClassNameBinding;
  /** Dynamic className expressions stay code-only until their expression can be preserved. */
  classNameDynamic?: true;
  /** Exact source binding for one direct static JSX text child. */
  text?: SourceLayerTextBinding;
  /** Compiler-derived slot state for a component use. Present only on slot nodes. */
  slot?: SourceSlotUsage;
  /** Definition-owned contract for an isolated Slot placeholder; it is not an editable component use. */
  slotContract?: SourceComponentSlot;
}

export interface SourceWorkspaceComponentReference {
  relativePath: string;
  exportName: string;
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
  /** Presentation-only Lucide icon markers discovered in source directories. */
  folderIcons?: readonly SourceWorkspaceFolderIcon[];
  /** Project-relative directories containing a package.json, used only for catalog navigation. */
  packageDirectories?: readonly string[];
  adapter?: "legacy" | "app-manifest";
  targets?: readonly SourceWorkspaceTarget[];
  library?: SourceWorkspaceLibrary;
  capabilities?: {
    createComponents: boolean;
  };
  approvals?: SourceApprovalEvidence;
}

export interface SourceWorkspaceFolderIcon {
  /** Project-relative directory containing the marker file. */
  directory: string;
  /** Kebab-case Lucide icon name taken from .<name>.lucide-icon. */
  name: string;
}

export interface SourceWorkspaceTargetDevice {
  id: DesignSpaceDevice;
  root: {
    source: string;
    export: string;
  };
  /** Stable source entry shared by devices that declare the same root. */
  entryId: string;
}

export interface SourceWorkspaceTarget {
  id: string;
  runtime: DesignSpaceRuntime;
  sourceRoot: string;
  entrypoint: string;
  devices: readonly SourceWorkspaceTargetDevice[];
  /** Runtime CSS owned by this target. Present after the server builds the browser workspace. */
  styles?: readonly string[];
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
  /** Package-derived catalog grouping. Missing means a composed component. */
  category?: "primitive" | "component";
}

export interface RuntimeSourceWorkspaceEntry extends SourceWorkspaceEntry {
  component: ComponentType<Record<string, unknown>>;
  design?: SourceComponentDesign & {
    load: () => Promise<ComponentDesignDefinition>;
  };
}

export interface RuntimeSourceWorkspace extends Omit<SourceWorkspaceManifest, "entries"> {
  entries: readonly RuntimeSourceWorkspaceEntry[];
  /** Server-registered files that are safe to expose in the source browser. */
  files?: readonly SourceWorkspaceFileEntry[];
  /** Target-owned CSS, injected only into the isolated preview document. */
  styles: readonly string[];
}

export interface SourceWorkspaceFileEntry {
  id: string;
  label: string;
  kind: "file" | "directory";
  parentId?: string;
  editable?: boolean;
}

export interface RuntimeSourceLibraryCatalog {
  packageName: string;
  development?: RuntimeSourceWorkspace;
  release?: {
    version: string;
    entries: readonly RuntimeSourceWorkspaceEntry[];
    styles: readonly string[];
  };
}
