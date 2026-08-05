
import { ComponentPropertyEditorProps } from "./ComponentPropertyEditor";
import { TextFields } from "./TextFields";
import { TailwindFields } from "./TailwindFields";
import { NumberFields } from "./NumberFields";
import { SelectFields } from "./SelectFields";

export function KindFields(props: ComponentPropertyEditorProps) {
  if (props.property.kind === "text") return <TextFields property={props.property} onChange={props.onChange} />;
  if (props.property.kind === "tailwind") return <TailwindFields property={props.property} onChange={props.onChange} />;
  if (props.property.kind === "number") return <NumberFields property={props.property} onChange={props.onChange} />;
  if (props.property.kind === "select") return <SelectFields property={props.property} onChange={props.onChange} />;
  return <p className="text-[10px] leading-4 text-zinc-600">Boolean properties have no additional constraints.</p>;
}
