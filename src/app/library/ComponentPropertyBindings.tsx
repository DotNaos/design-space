import { Link2 } from "lucide-react";

import type { ComponentControl } from "../../shared/contracts";
import type { DesignComponentNode, DesignDocument } from "../../shared/design-document";
import type { AcceptedComponentOption } from "./ComponentSlotEditor";
import { PropertyBinding } from "./PropertyBinding";

export interface BindingComponentOption extends AcceptedComponentOption {
  controls: readonly ComponentControl[];
}

export interface BindingTarget {
  instanceId: string;
  prop: string;
  kind: ComponentControl["kind"];
  label: string;
}

export function ComponentPropertyBindings(props: {
  document: DesignDocument;
  catalogComponents: readonly BindingComponentOption[];
  onChange: (document: DesignDocument) => void;
}) {
  const definition = props.document.component;
  if (!definition) return null;
  const targets = props.document.root
    ? collectTargets(props.document.root, new Map(props.catalogComponents.map((item) => [item.id, item])))
    : [];
  return (
    <div className="space-y-3 border-t border-white/10 pt-4">
      <div className="flex items-start gap-2">
        <Link2 aria-hidden="true" className="mt-0.5 shrink-0 text-sky-400" size={13} />
        <div>
          <h4 className="text-[10px] font-medium text-zinc-400">Implementation bindings</h4>
          <p className="mt-1 text-[10px] leading-4 text-zinc-600">Each public property controls exactly one compatible property in the component body.</p>
        </div>
      </div>
      {definition.properties.map((property) => (
        <PropertyBinding
          key={property.id}
          document={props.document}
          property={property}
          targets={targets.filter((target) => target.kind === property.kind)}
          onChange={props.onChange}
        />
      ))}
      {!definition.properties.length && <p className="text-[10px] text-zinc-600">Add a public property to create a binding.</p>}
    </div>
  );
}

function collectTargets(
  node: DesignComponentNode,
  components: ReadonlyMap<string, BindingComponentOption>,
): BindingTarget[] {
  const component = components.get(node.adapterId);
  const label = node.label ?? component?.label ?? node.adapterId;
  return [
    ...(component?.controls ?? []).map((control) => ({
      instanceId: node.instanceId,
      prop: control.prop,
      kind: control.kind,
      label: `${label} · ${control.label}`,
    })),
    ...Object.values(node.slots).flatMap((children) => children.flatMap((child) => (
      child.kind === "component" ? collectTargets(child.node, components) : []
    ))),
  ];
}

export function findBinding(node: DesignComponentNode, propertyId: string): { instanceId: string; prop: string } | undefined {
  const prop = Object.entries(node.propertyBindings ?? {}).find(([, id]) => id === propertyId)?.[0];
  if (prop) return { instanceId: node.instanceId, prop };
  for (const children of Object.values(node.slots)) {
    for (const child of children) {
      if (child.kind !== "component") continue;
      const binding = findBinding(child.node, propertyId);
      if (binding) return binding;
    }
  }
  return undefined;
}
