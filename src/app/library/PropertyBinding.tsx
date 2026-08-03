
import type { ComponentPropertyDraft, DesignDocument } from "../../shared/design-document";
import { EditorSelectField } from "../components/EditorSelectField/EditorSelectField";
import { bindComponentProperty } from "../document/document-commands";
import { BindingTarget, findBinding } from "./ComponentPropertyBindings";

export function PropertyBinding(props: {
  document: DesignDocument;
  property: ComponentPropertyDraft;
  targets: readonly BindingTarget[];
  onChange: (document: DesignDocument) => void;
}) {
  const current = props.document.root ? findBinding(props.document.root, props.property.id) : undefined;
  const currentIndex = current
    ? props.targets.findIndex((target) => target.instanceId === current.instanceId && target.prop === current.prop)
    : -1;
  const unavailable = Boolean(current && currentIndex < 0);
  return (
    <div>
      <EditorSelectField
        ariaLabel={`Binding for ${props.property.label}`}
        label={(
          <span className="flex items-center justify-between gap-2">
            <span className="truncate">{props.property.label}</span>
            <code className="truncate font-mono text-[9px] text-zinc-700">{props.property.prop}</code>
          </span>
        )}
        options={[
          { id: "unbound", value: "", label: "Not bound" },
          ...(unavailable ? [{ id: "unavailable", value: "__unavailable__", label: "Unavailable binding", disabled: true }] : []),
          ...props.targets.map((target, index) => ({
            id: `target-${index}`,
            value: String(index),
            label: target.label,
          })),
        ]}
        value={unavailable ? "__unavailable__" : currentIndex < 0 ? "" : String(currentIndex)}
        onChange={(value) => {
          const target = value === "" ? undefined : props.targets[Number(value)];
          props.onChange(bindComponentProperty(
            props.document,
            props.property.id,
            target ? { instanceId: target.instanceId, prop: target.prop } : undefined,
          ));
        }}
      />
      {!props.targets.length && <span className="mt-1 block leading-4 text-amber-300/80">No compatible implementation property is available yet.</span>}
    </div>
  );
}
