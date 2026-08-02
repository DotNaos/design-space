import { Tabs } from "@heroui/react";

import { boxUnits, type BoxUnit } from "./tailwind-box-model-values";

const labels: Record<BoxUnit, string> = {
  px: "px",
  rem: "rem",
  tailwind: "Tailwind",
};

const descriptions: Record<BoxUnit, string> = {
  px: "Pixels",
  rem: "Rem units · 1 rem = 16 px",
  tailwind: "Tailwind spacing · 1 = 4 px",
};

export function BoxModelUnitTabs(props: { onChange: (unit: BoxUnit) => void; value: BoxUnit }) {
  return (
    <Tabs
      className="shrink-0"
      data-box-unit-tabs
      selectedKey={props.value}
      onSelectionChange={(key) => props.onChange(key as BoxUnit)}
    >
      <Tabs.ListContainer className="rounded-lg bg-[#0d0e11] p-0.5">
        <Tabs.List
          aria-label="Box model units"
          className="h-6 gap-0 rounded-md bg-transparent p-0 **:data-[slot=tabs-tab]:h-6 **:data-[slot=tabs-tab]:min-w-0 **:data-[slot=tabs-tab]:rounded-md **:data-[slot=tabs-tab]:bg-transparent **:data-[slot=tabs-tab]:px-2 **:data-[slot=tabs-tab]:text-[9px] **:data-[slot=tabs-tab]:font-medium **:data-[slot=tabs-tab]:tracking-[-0.01em] **:data-[slot=tabs-tab]:text-zinc-600 **:data-[slot=tabs-tab]:transition-[color,transform] **:data-[slot=tabs-tab]:data-[hovered=true]:text-zinc-300 **:data-[slot=tabs-tab]:data-[pressed=true]:scale-[0.96] **:data-[slot=tabs-tab]:data-[selected=true]:text-zinc-100 **:data-[slot=tabs-indicator]:rounded-md **:data-[slot=tabs-indicator]:bg-[#2b2d33] **:data-[slot=tabs-indicator]:shadow-[inset_0_1px_rgba(255,255,255,0.04)]"
        >
          {boxUnits.map((unit) => (
            <Tabs.Tab aria-label={descriptions[unit]} data-box-unit={unit} id={unit} key={unit}>
              <span className="relative z-10">{labels[unit]}</span>
              <Tabs.Indicator />
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.ListContainer>
    </Tabs>
  );
}
