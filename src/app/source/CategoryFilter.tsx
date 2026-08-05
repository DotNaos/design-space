import { ListBox, Select } from "@heroui/react";
import { ListFilter } from "lucide-react";
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
      className="w-9 shrink-0"
      selectedKey={props.value}
      onSelectionChange={(key) => props.onChange(String(key) as SourceLibraryCategory)}
    >
      <Select.Trigger
        className="flex size-9 items-center justify-center rounded-full bg-white/[0.045] text-zinc-500 outline-none transition-colors hover:bg-white/[0.075] hover:text-zinc-300 data-[focus-visible]:bg-white/[0.08] data-[pressed]:bg-violet-500/[0.14] data-[pressed]:text-violet-200"
      >
        <ListFilter aria-hidden="true" size={14} />
        <Select.Value className="sr-only" />
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
