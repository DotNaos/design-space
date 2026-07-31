import { Button, ListBox, Select } from "@heroui/react";
import { Grid2X2 } from "lucide-react";

export function SourceDesignControls(props: {
  caseNames: readonly string[];
  isStateful: boolean;
  matrix: boolean;
  matrixAvailable: boolean;
  selectedCase: string;
  stale: boolean;
  onCaseChange: (value: string) => void;
  onMatrixChange: () => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      {props.stale ? <span className="hidden text-[9px] text-amber-300 xl:inline">Last valid</span> : null}
      <span className="hidden text-[9px] text-zinc-600 xl:inline">{props.isStateful ? "State" : "Variant"}</span>
      <Select aria-label={props.isStateful ? "Component state" : "Component variant"} className="w-24 min-w-0 shrink-0" selectedKey={props.selectedCase} onSelectionChange={(key) => props.onCaseChange(String(key))}>
        <Select.Trigger className="flex h-6 min-w-0 items-center gap-1 rounded-md border border-white/10 bg-[#18191c] px-1.5 text-[10px] text-zinc-300 outline-none">
          <Select.Value className="min-w-0 flex-1 truncate text-left" />
          <Select.Indicator className="size-3 shrink-0 text-zinc-500" />
        </Select.Trigger>
        <Select.Popover placement="bottom end" className="max-h-64 min-w-36 overflow-y-auto rounded-lg border border-white/10 bg-[#18191c] p-1 shadow-2xl">
          <ListBox items={props.caseNames.map((name) => ({ id: name, name }))}>
            {(item) => <ListBox.Item id={item.id} textValue={item.name} className="flex min-h-8 cursor-default items-center rounded-md px-2 text-xs text-zinc-300 outline-none data-[focused]:bg-white/10 data-[selected]:text-sky-300">{item.name}<ListBox.ItemIndicator className="ml-auto size-3" /></ListBox.Item>}
          </ListBox>
        </Select.Popover>
      </Select>
      {props.matrixAvailable ? <Button isIconOnly aria-label="Toggle property matrix" aria-pressed={props.matrix} className={`size-6 min-w-6 ${props.matrix ? "bg-sky-400/15 text-sky-300" : "text-zinc-500"}`} size="sm" variant="ghost" onPress={props.onMatrixChange}><Grid2X2 aria-hidden="true" size={12} /></Button> : null}
    </div>
  );
}
