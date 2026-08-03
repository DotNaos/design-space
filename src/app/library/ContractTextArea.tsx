import { Label, TextArea, TextField } from "@heroui/react";
import { inputClassName } from "./ContractEditorFields";

export function ContractTextArea(props: {
  label: string;
  value: string;
  placeholder?: string;
  rows?: number;
  onChange: (value: string) => void;
}) {
  return (
    <TextField fullWidth value={props.value} onChange={props.onChange}>
      <Label className="text-[10px] text-zinc-500">{props.label}</Label>
      <TextArea
        aria-label={props.label}
        className={`${inputClassName} resize-y py-2`}
        placeholder={props.placeholder}
        rows={props.rows ?? 3}
      />
    </TextField>
  );
}
