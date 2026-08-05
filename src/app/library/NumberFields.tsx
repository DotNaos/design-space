
import type { ComponentPropertyDraft } from "../../shared/design-document";
import { ContractTextInput, OptionalNumberInput } from "./ContractEditorFields";
import { PropertyOfKind } from "./ComponentPropertyEditor";

export function NumberFields(props: { property: PropertyOfKind<"number">; onChange: (property: ComponentPropertyDraft) => void }) {
  const setNumber = (key: "min" | "max" | "step", value: number | undefined) => {
    const next = { ...props.property };
    if (value === undefined) {
      delete next[key];
    } else if (key === "min" && props.property.max !== undefined && value > props.property.max) {
      next.min = value;
      next.max = value;
    } else if (key === "max" && props.property.min !== undefined && value < props.property.min) {
      next.min = value;
      next.max = value;
    } else {
      next[key] = value;
    }
    props.onChange(next);
  };
  const setUnit = (unit: string) => {
    const next = { ...props.property };
    if (unit === "") delete next.unit;
    else next.unit = unit;
    props.onChange(next);
  };
  return (
    <div className="space-y-3 border-t border-white/5 pt-3">
      <h4 className="text-[10px] font-medium text-zinc-500">Number constraints</h4>
      <div className="grid grid-cols-2 gap-2">
        <OptionalNumberInput label="Minimum" value={props.property.min} onChange={(value) => setNumber("min", value)} />
        <OptionalNumberInput label="Maximum" value={props.property.max} onChange={(value) => setNumber("max", value)} />
        <OptionalNumberInput label="Step" min={Number.EPSILON} value={props.property.step} onChange={(value) => setNumber("step", value)} />
        <ContractTextInput label="Unit" value={props.property.unit ?? ""} onChange={setUnit} />
      </div>
      {props.property.min !== undefined && props.property.max !== undefined && props.property.min > props.property.max
        ? <p role="alert" className="text-[10px] text-rose-300">Maximum must be at least the minimum.</p>
        : null}
    </div>
  );
}
