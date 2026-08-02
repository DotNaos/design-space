import { ListBox, Select } from "@heroui/react";
import { Component } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { ComponentDesignDefinition } from "../../shared/component-design";
import type { SourceComponentDesign, SourceWorkspaceEntry } from "../../shared/source-workspace";

type LoadableDesign = SourceComponentDesign & {
  load: () => Promise<ComponentDesignDefinition>;
};

export function SourceDesignCaseControl(props: {
  className?: string;
  entry: SourceWorkspaceEntry;
  selectedCase?: string;
  onCaseChange?: (caseName: string) => void;
}) {
  const design = loadableDesign(props.entry.design);
  const [definition, setDefinition] = useState<ComponentDesignDefinition>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!design) {
      setDefinition(undefined);
      setError(undefined);
      return;
    }
    let active = true;
    void design.load().then((loaded) => {
      if (!active) return;
      setDefinition(loaded);
      setError(undefined);
    }).catch((reason: unknown) => {
      if (!active) return;
      setDefinition(undefined);
      setError(reason instanceof Error ? reason.message : "The component design could not be loaded.");
    });
    return () => { active = false; };
  }, [design?.fileId]);

  const cases = useMemo(() => Object.keys(definition?.cases ?? {}), [definition]);
  if (!design) return null;

  const label = definition?.isStateful ? "Component state" : "Props preset";
  const selectedCase = definition && cases.includes(props.selectedCase ?? "")
    ? props.selectedCase!
    : definition?.initialCase;

  return (
    <section aria-label={label} className={`px-4 py-2 ${props.className ?? ""}`}>
      <div className="flex items-center gap-2">
        <Component aria-hidden="true" className="text-violet-400" size={13} />
        <h3 className="min-w-0 flex-1 truncate text-[10px] font-medium text-zinc-400" title={design.relativePath}>{label}</h3>
        {definition && selectedCase ? (
          <Select
            aria-label={label}
            className="w-36 shrink-0"
            selectedKey={selectedCase}
            onSelectionChange={(key) => props.onCaseChange?.(String(key))}
          >
            <Select.Trigger className="flex h-7 min-w-0 items-center gap-1.5 rounded-lg border-0 bg-black/20 px-2.5 text-[10px] text-zinc-300 outline-none data-[focus-visible]:ring-1 data-[focus-visible]:ring-sky-300/40">
              <Select.Value className="min-w-0 flex-1 truncate text-left" />
              <Select.Indicator className="size-3 shrink-0 text-zinc-500" />
            </Select.Trigger>
            <Select.Popover placement="bottom end" className="max-h-64 min-w-40 overflow-y-auto rounded-lg bg-[#18191c] p-1 shadow-2xl">
              <ListBox items={cases.map((name) => ({ id: name, name }))}>
                {(item) => (
                  <ListBox.Item
                    id={item.id}
                    textValue={item.name}
                    className="flex min-h-8 cursor-default items-center rounded-md px-2 text-xs text-zinc-300 outline-none data-[focused]:bg-white/10 data-[selected]:text-sky-300"
                  >
                    {item.name}
                    <ListBox.ItemIndicator className="ml-auto size-3" />
                  </ListBox.Item>
                )}
              </ListBox>
            </Select.Popover>
          </Select>
        ) : (
          <span className={`text-[9px] ${error ? "text-red-300" : "text-zinc-600"}`}>
            {error ? "Invalid design" : "Loading…"}
          </span>
        )}
      </div>
      {error ? <p className="mt-2 text-[9px] leading-4 text-red-300/80">{error}</p> : null}
    </section>
  );
}

function loadableDesign(design: SourceComponentDesign | undefined): LoadableDesign | undefined {
  if (!design || typeof (design as Partial<LoadableDesign>).load !== "function") return undefined;
  return design as LoadableDesign;
}
