
import { EditorSelectField } from "../components/EditorSelectField/EditorSelectField";

export function ContractSelect(props: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <EditorSelectField
      ariaLabel={props.label}
      label={props.label}
      options={props.options.map((option, index) => ({ id: `option-${index}`, ...option }))}
      value={props.value}
      onChange={props.onChange}
    />
  );
}
