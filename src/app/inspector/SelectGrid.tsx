
import { EditorSelectField } from "../components/EditorSelectField/EditorSelectField";
import { replaceTailwindUtilityGroup } from "./tailwind-utility";
import { UtilityGroup, findBaseSelection, optionValues, selectOptions } from "./TailwindMappedControls";

export function SelectGrid(props: { current: string; groups: readonly UtilityGroup[]; onChange: (value: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {props.groups.map((group) => {
        const selection = findBaseSelection(props.current, group);
        return (
          <EditorSelectField
            key={group.id}
            ariaLabel={`${group.label} Tailwind utility`}
            density="compact"
            label={group.label}
            options={selectOptions(group, selection)}
            value={selection.token}
            onChange={(value) => props.onChange(replaceTailwindUtilityGroup(props.current, optionValues(group), value, group.matches))}
          />
        );
      })}
    </div>
  );
}
