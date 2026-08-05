import { Tabs } from "@heroui/react";
import { ToolId } from "./ItemEditorTools";

export function ToolPanel(props: { desktop: boolean; id: ToolId; children: React.ReactNode }) {
  return (
    <Tabs.Panel
      id={props.id}
      className={`${props.desktop ? "!ml-12 !mt-0 !mr-0 !mb-0" : "!m-0"} h-full min-h-0 overflow-y-auto overscroll-contain bg-[#141518] !p-0 outline-none`}
    >
      {props.children}
    </Tabs.Panel>
  );
}
