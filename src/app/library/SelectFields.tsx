import { Button } from "@heroui/react";
import { Plus, Trash2 } from "lucide-react";
import type { ComponentPropertyDraft } from "../../shared/design-document";
import { ContractTextInput, OptionalNumberInput } from "./ContractEditorFields";
import { PropertyOfKind, uniqueValue } from "./ComponentPropertyEditor";

export function SelectFields(props: { property: PropertyOfKind<"select">; onChange: (property: ComponentPropertyDraft) => void }) {
  const addOption = () => {
    const value = uniqueValue("option", new Set(props.property.options.map((option) => option.value)));
    props.onChange({ ...props.property, options: [...props.property.options, { label: `Option ${props.property.options.length + 1}`, value }] });
  };
  const updateOption = (index: number, patch: Partial<PropertyOfKind<"select">["options"][number]>) => {
    const previous = props.property.options[index];
    const options = props.property.options.map((option, item) => item === index ? { ...option, ...patch } : option);
    const next = { ...props.property, options };
    if (props.property.defaultValue === previous.value) next.defaultValue = options[index].value;
    props.onChange(next);
  };
  const removeOption = (index: number) => {
    if (props.property.options.length === 1) return;
    const removed = props.property.options[index];
    const options = props.property.options.filter((_, item) => item !== index);
    const next = { ...props.property, options };
    if (props.property.defaultValue === removed.value) next.defaultValue = options[0].value;
    props.onChange(next);
  };
  return (
    <div className="space-y-3 border-t border-white/5 pt-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-[10px] font-medium text-zinc-500">Select options</h4>
        <Button size="sm" variant="ghost" onPress={addOption}><Plus size={12} /> Option</Button>
      </div>
      {props.property.options.map((option, index) => (
        <div key={index} className="space-y-2 border-t border-white/5 pt-3 first:border-t-0 first:pt-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1">
              {(["text", "number"] as const).map((type) => (
                <Button key={type} aria-label={`Set Option ${index + 1} value type to ${type}`} aria-pressed={(typeof option.value === "number" ? "number" : "text") === type} size="sm" variant={(typeof option.value === "number" ? "number" : "text") === type ? "secondary" : "ghost"} onPress={() => updateOption(index, { value: type === "number" ? Number(option.value) || 0 : String(option.value) })}>{type}</Button>
              ))}
            </div>
            <Button aria-label={`Remove ${option.label} option`} isDisabled={props.property.options.length === 1} isIconOnly size="sm" variant="ghost" onPress={() => removeOption(index)}><Trash2 size={12} /></Button>
          </div>
          <ContractTextInput label={`Option ${index + 1} label`} value={option.label} onChange={(label) => updateOption(index, { label })} />
          {typeof option.value === "number"
            ? <OptionalNumberInput label={`Option ${index + 1} value`} value={option.value} onChange={(value) => updateOption(index, { value: value ?? 0 })} />
            : <ContractTextInput label={`Option ${index + 1} value`} value={option.value} onChange={(value) => updateOption(index, { value })} />}
        </div>
      ))}
    </div>
  );
}
