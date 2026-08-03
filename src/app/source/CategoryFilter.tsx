import { ListBox, Select } from "@heroui/react";
import { type SourceLibraryCategory } from "./source-library-catalog";

export function CategoryFilter(props: {
  value: SourceLibraryCategory;
  onChange: (value: SourceLibraryCategory) => void;
}) {
  const options = [
    { id: "all", label: "All components" },
    { id: "primitive", label: "Primitives" },
    { id: "composed", label: "Composed" },
  ] satisfies readonly { id: SourceLibraryCategory; label: string }[];
  return (
    <Select
      aria-label="Component category"
      className="mt-2 w-full"
      selectedKey={props.value}
      onSelectionChange={(key) => props.onChange(String(key) as SourceLibraryCategory)}
    >
      <Select.Trigger className="flex h-8 w-full items-center gap-1.5 rounded-full bg-white/[0.045] px-3 text-[10px] text-zinc-300 outline-none transition-colors data-[focus-visible]:bg-white/[0.08]">
        <Select.Value className="min-w-0 flex-1 truncate text-left !text-[10px] !leading-none" />
        <Select.Indicator className="size-3 shrink-0 text-zinc-500" />
      </Select.Trigger>
      <Select.Popover placement="bottom" className="min-w-44 rounded-lg bg-[#1b1c20] p-1 shadow-2xl">
        <ListBox items={options}>
          {(item) => (
            <ListBox.Item
              className="flex min-h-8 cursor-default items-center rounded-md px-2 text-xs text-zinc-300 outline-none data-[focused]:bg-white/10 data-[selected]:text-sky-300"
              id={item.id}
              textValue={item.label}
            >
              {item.label}
              <ListBox.ItemIndicator className="ml-auto size-3" />
            </ListBox.Item>
          )}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
