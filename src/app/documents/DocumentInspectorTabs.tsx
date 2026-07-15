import { Tabs } from "@heroui/react";
import { Braces, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";

import { DocumentSourcePanel } from "./DocumentSourcePanel";

export function DocumentInspectorTabs(props: {
  design: ReactNode;
  source: string;
  sourceLabel: string;
}) {
  return (
    <Tabs className="flex h-full min-h-0 w-full flex-col bg-[#141518]" defaultSelectedKey="inspector-design" variant="secondary">
      <Tabs.ListContainer className="shrink-0 border-b border-white/10 px-2">
        <Tabs.List
          aria-label="Inspector views"
          className="h-11 w-fit *:h-11 *:gap-1.5 *:px-3 *:text-[11px] *:font-medium *:text-zinc-500 *:data-[selected=true]:text-zinc-100"
        >
          <Tabs.Tab id="inspector-design">
            <SlidersHorizontal aria-hidden="true" size={13} /> Design
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="inspector-code">
            <Braces aria-hidden="true" size={13} /> Code
            <Tabs.Indicator />
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.ListContainer>
      <Tabs.Panel className="min-h-0 flex-1 overflow-hidden p-0" id="inspector-design">{props.design}</Tabs.Panel>
      <Tabs.Panel className="min-h-0 flex-1 overflow-hidden p-0" id="inspector-code">
        <DocumentSourcePanel className="flex h-full w-full" label={props.sourceLabel} source={props.source} />
      </Tabs.Panel>
    </Tabs>
  );
}
