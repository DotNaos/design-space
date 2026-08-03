
import { ContractSelect, ContractSwitch, ContractTextArea, ContractTextInput, OptionalNumberInput } from "./ContractEditorFields";
import { ComponentPropertyEditorProps } from "./ComponentPropertyEditor";

export function DefaultValueEditor(props: ComponentPropertyEditorProps) {
  const { property } = props;
  if (property.kind === "boolean") {
    return <ContractSwitch label="Default value" selected={property.defaultValue === true} onChange={(defaultValue) => props.onChange({ ...property, defaultValue })} />;
  }
  if (property.kind === "number") {
    return (
      <OptionalNumberInput
        label="Default value"
        max={property.max}
        min={property.min}
        step={property.step}
        value={typeof property.defaultValue === "number" ? property.defaultValue : 0}
        onChange={(defaultValue) => props.onChange({ ...property, defaultValue: defaultValue ?? 0 })}
      />
    );
  }
  if (property.kind === "select") {
    const selectedIndex = Math.max(0, property.options.findIndex((option) => option.value === property.defaultValue));
    return (
      <ContractSelect
        label="Default value"
        options={property.options.map((option, index) => ({ value: String(index), label: option.label }))}
        value={String(selectedIndex)}
        onChange={(index) => props.onChange({ ...property, defaultValue: property.options[Number(index)]?.value ?? property.options[0].value })}
      />
    );
  }
  const value = typeof property.defaultValue === "string" ? property.defaultValue : "";
  if (property.kind === "text" && property.multiline) {
    return <ContractTextArea label="Default value" value={value} onChange={(defaultValue) => props.onChange({ ...property, defaultValue })} />;
  }
  return <ContractTextInput label="Default value" value={value} onChange={(defaultValue) => props.onChange({ ...property, defaultValue })} />;
}
