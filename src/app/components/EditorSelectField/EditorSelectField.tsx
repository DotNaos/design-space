import { Label, ListBox, Select } from "@heroui/react";
import { useCallback, useState } from "react";
import type { ReactNode } from "react";

export interface EditorSelectOption {
  id: string;
  value: string;
  label: string;
  disabled?: boolean;
}

export function EditorSelectField(props: {
  ariaLabel: string;
  label: ReactNode;
  value: string;
  options: readonly EditorSelectOption[];
  density?: "compact" | "regular";
  onChange: (value: string) => void;
}) {
  const compact = props.density === "compact";
  const selected = props.options.find((option) => option.value === props.value);
  const disabledKeys = props.options.filter((option) => option.disabled).map((option) => option.id);
  const [portalContainer, setPortalContainer] = useState<Element | null>(null);
  const capturePortalContainer = useCallback((node: HTMLDivElement | null) => {
    const next = node?.closest("dialog") ?? null;
    setPortalContainer((current) => current === next ? current : next);
  }, []);

  return (
    <Select
      fullWidth
      ref={capturePortalContainer}
      disabledKeys={disabledKeys}
      selectedKey={selected?.id ?? null}
      onSelectionChange={(key) => {
        const option = props.options.find((candidate) => candidate.id === String(key));
        if (option && !option.disabled) props.onChange(option.value);
      }}
    >
      <Label className={compact ? "text-[9px] text-zinc-600" : "text-[10px] text-zinc-500"}>
        <span aria-hidden="true">{props.label}</span>
        <span className="sr-only">{props.ariaLabel}</span>
      </Label>
      <Select.Trigger
        className={`${compact ? "mt-1 min-h-11 px-2 text-xs lg:min-h-10" : "mt-1 min-h-11 px-3 text-base lg:text-sm"} flex w-full items-center gap-2 rounded-lg border border-white/10 bg-black/20 text-zinc-200 outline-none transition-[border-color,background-color,transform] duration-150 hover:border-white/20 hover:bg-white/[0.035] data-[focus-visible]:border-sky-400 data-[pressed]:scale-[0.995] motion-reduce:transition-none`}
      >
        <Select.Value className="min-w-0 flex-1 truncate text-left">{selected?.label}</Select.Value>
        <Select.Indicator className="size-4 shrink-0 text-zinc-500 transition-transform duration-150 data-[open=true]:rotate-180 motion-reduce:transition-none" />
      </Select.Trigger>
      <Select.Popover
        UNSTABLE_portalContainer={portalContainer ?? undefined}
        placement="bottom start"
        className="max-h-72 w-[var(--trigger-width)] overflow-y-auto rounded-xl border border-white/10 bg-[#18191c] p-1 shadow-2xl outline-none entering:animate-in entering:fade-in entering:zoom-in-95 exiting:animate-out exiting:fade-out exiting:zoom-out-95 motion-reduce:transition-none"
      >
        <ListBox items={props.options}>
          {(option) => (
            <ListBox.Item
              id={option.id}
              textValue={option.label}
              className="flex min-h-11 cursor-default items-center gap-2 rounded-lg px-3 text-sm text-zinc-300 outline-none transition-colors data-[disabled]:text-zinc-600 data-[focused]:bg-white/10 data-[hovered]:bg-white/[0.06] data-[selected]:text-white motion-reduce:transition-none lg:min-h-10"
            >
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              <ListBox.ItemIndicator className="size-4 shrink-0 text-sky-400" />
            </ListBox.Item>
          )}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
