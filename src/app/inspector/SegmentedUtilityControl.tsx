
import { Minus, Square } from "lucide-react";
import { EditorIconTabs } from "../components/EditorIconTabs/EditorIconTabs";
import { UtilityGroup, findBaseSelection, replaceSegmentedUtility } from "./TailwindMappedControls";

export function SegmentedUtilityControl(props: {
  current: string;
  group: UtilityGroup;
  onChange: (value: string) => void;
  onPreviewChange?: (value?: string) => void;
}) {
  const selection = findBaseSelection(props.current, props.group);
  const valueFor = (next: string) => replaceSegmentedUtility(props.current, props.group, next);
  const change = (next: string) => props.onChange(valueFor(next));
  return (
    <div className="min-w-0">
      <div className="mb-1 flex min-h-4 items-center gap-1.5">
        <span className="text-[9px] text-zinc-600">{props.group.label}</span>
        {selection.custom && <span className="min-w-0 truncate text-[8px] text-amber-300/80">Custom · {selection.token}</span>}
      </div>
      <EditorIconTabs
        ariaLabel={`${props.group.label} options`}
        tabs={[
          { icon: <Minus aria-hidden="true" size={14} strokeWidth={1.7} />, label: `${props.group.label}: Auto`, value: "" },
          ...props.group.options.map((option) => {
            const Icon = option.icon ?? Square;
            return { icon: <Icon aria-hidden="true" size={14} strokeWidth={1.7} />, label: `${props.group.label}: ${option.label}`, value: option.value };
          }),
        ]}
        value={selection.custom ? undefined : selection.utility}
        onChange={change}
        onPreview={(value) => props.onPreviewChange?.(valueFor(value))}
        onPreviewEnd={() => props.onPreviewChange?.()}
      />
    </div>
  );
}
