import { Disclosure } from "@heroui/react";
import { useState } from "react";

export function WorkshopSection(props: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <Disclosure className="border-b border-white/10 px-4 py-4" isExpanded={expanded} onExpandedChange={setExpanded}>
      <Disclosure.Heading className={`${expanded ? "mb-3" : ""} flex min-h-9 items-center gap-2`}>
        <Disclosure.Trigger className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left lg:min-h-8">
          <Disclosure.Indicator className="shrink-0 text-zinc-600" />
          <span className="truncate text-xs font-semibold text-zinc-300">{props.title}</span>
        </Disclosure.Trigger>
        {props.action}
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body className="space-y-3 p-0">{props.children}</Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
}
