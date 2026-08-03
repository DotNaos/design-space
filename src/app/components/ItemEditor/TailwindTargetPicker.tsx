
import type { ComponentControl } from "../../../shared/contracts";
import { EditorSelectField } from "../EditorSelectField/EditorSelectField";

export function TailwindTargetPicker(props: {
  controls: readonly ComponentControl[];
  selectedProp: string;
  onChange: (prop: string) => void;
}) {
  if (props.controls.length < 2) return null;
  return (
    <div className="border-b border-white/10 px-4 py-3">
      <EditorSelectField
        ariaLabel="Tailwind property"
        density="compact"
        label="Style property"
        options={props.controls.map((control) => ({ id: control.id, label: control.label, value: control.prop }))}
        value={props.selectedProp}
        onChange={props.onChange}
      />
    </div>
  );
}
