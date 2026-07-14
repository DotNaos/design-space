export type ComponentId = string;
export type ComponentInstanceId = string;
export type SlotId = string;

export interface SlotDefinition {
  readonly id: SlotId;
  readonly label: string;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly accepts?: readonly ComponentId[];
}

export interface HtmlTreeNode {
  readonly kind: "html";
  readonly id: string;
  readonly tagName: string;
  readonly slotId?: SlotId;
  readonly children?: readonly HtmlTreeNode[];
}

export interface ComponentAdapterDefinition<Props = Readonly<Record<string, unknown>>> {
  readonly id: ComponentId;
  readonly label: string;
  readonly slots: readonly SlotDefinition[];
  readonly defaultProps?: Props;
  readonly internalHtml?: readonly HtmlTreeNode[];
}

export interface ComponentChild {
  readonly kind: "component";
  readonly instance: ComponentInstance;
}

export interface TextChild {
  readonly kind: "text";
  readonly id: string;
  readonly value: string;
}

export type SlotChild = ComponentChild | TextChild;

export interface SlotContent {
  readonly slotId: SlotId;
  readonly children: readonly SlotChild[];
}

export interface ComponentInstance {
  readonly instanceId: ComponentInstanceId;
  readonly componentId: ComponentId;
  readonly props?: Readonly<Record<string, unknown>>;
  readonly slots: readonly SlotContent[];
}

export interface AdapterCatalog {
  readonly adapters: ReadonlyMap<ComponentId, ComponentAdapterDefinition>;
}

export type SelectionTarget =
  | { readonly kind: "component"; readonly id: ComponentInstanceId }
  | {
      readonly kind: "slot";
      readonly id: string;
      readonly componentInstanceId: ComponentInstanceId;
      readonly slotId: SlotId;
    }
  | {
      readonly kind: "html";
      readonly id: string;
      readonly componentInstanceId: ComponentInstanceId;
      readonly nodeId: string;
    }
  | {
      readonly kind: "slot-outlet";
      readonly id: string;
      readonly outletId: string;
      readonly slotId: SlotId;
    };

export interface SlotProjection {
  readonly selection: Extract<SelectionTarget, { kind: "slot" }>;
  readonly label: string;
  readonly occupied: boolean;
  readonly childCount: number;
}
