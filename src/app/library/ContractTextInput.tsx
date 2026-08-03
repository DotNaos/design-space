import { Input, Label, TextField } from "@heroui/react";
import { inputClassName } from "./ContractEditorFields";

export function ContractTextInput(props: {
  label: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <TextField fullWidth isDisabled={props.disabled} value={props.value} onChange={props.onChange}>
      <Label className="text-[10px] text-zinc-500">{props.label}</Label>
      <Input aria-label={props.label} className={inputClassName} placeholder={props.placeholder} />
    </TextField>
  );
}
