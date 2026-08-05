
import type { ComponentPropertyDraft } from "../../shared/design-document";
import { ContractSwitch, ContractTextInput, OptionalNumberInput } from "./ContractEditorFields";
import { PropertyOfKind } from "./ComponentPropertyEditor";

export function TextFields(props: { property: PropertyOfKind<"text">; onChange: (property: ComponentPropertyDraft) => void }) {
  const setMaxLength = (maxLength: number | undefined) => {
    const next = { ...props.property };
    if (maxLength === undefined) delete next.maxLength;
    else next.maxLength = maxLength;
    props.onChange(next);
  };
  const setPlaceholder = (placeholder: string) => {
    const next = { ...props.property };
    if (placeholder === "") delete next.placeholder;
    else next.placeholder = placeholder;
    props.onChange(next);
  };
  return (
    <div className="space-y-3 border-t border-white/5 pt-3">
      <h4 className="text-[10px] font-medium text-zinc-500">Text constraints</h4>
      <ContractSwitch label="Multiline" selected={props.property.multiline === true} onChange={(multiline) => props.onChange({ ...props.property, multiline })} />
      <OptionalNumberInput integer label="Maximum length" min={1} placeholder="No limit" value={props.property.maxLength} onChange={setMaxLength} />
      <ContractTextInput label="Placeholder" value={props.property.placeholder ?? ""} onChange={setPlaceholder} />
    </div>
  );
}
