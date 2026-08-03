
import { UtilityGroup } from "./TailwindMappedControls";
import { SliderUtilityControl } from "./SliderUtilityControl";

export function SliderGrid(props: {
  current: string;
  groups: readonly UtilityGroup[];
  onChange: (value: string) => void;
  onPreviewChange?: (value?: string) => void;
}) {
  return <div className="grid gap-3">{props.groups.map((group) => <SliderUtilityControl key={group.id} {...props} group={group} />)}</div>;
}
