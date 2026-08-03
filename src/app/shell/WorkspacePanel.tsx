
import { type ReactNode } from "react";
import { type WorkspacePanelWidths } from "./workspace-panel-state";
import { WorkspacePanelToggle } from "./WorkspacePanelToggle";

export function WorkspacePanel(props: {
  content: ReactNode;
  contentClassName?: string;
  controls: string;
  label: string;
  header?: ReactNode;
  hideToggle?: boolean;
  managedHeader?: boolean;
  side: keyof WorkspacePanelWidths;
  suppressed: boolean;
  visible: boolean;
  workspaceExpanded: boolean;
  onToggle: () => void;
}) {
  if (props.managedHeader) {
    return (
      <section
        className="flex min-h-0 min-w-0 flex-col overflow-hidden"
        data-workspace-panel={props.side}
        data-workspace-panel-collapsed={!props.visible || undefined}
        data-workspace-panel-expanded={props.workspaceExpanded || undefined}
        data-workspace-panel-suppressed={props.suppressed || undefined}
      >
        {props.header}
        <div
          id={props.controls}
          aria-label={props.label}
          aria-hidden={!props.visible || props.suppressed}
          className={`min-h-0 min-w-0 flex-1 overflow-hidden ${
            props.visible && !props.suppressed ? props.contentClassName ?? "" : "hidden"
          }`}
          role="region"
        >
          {props.content}
        </div>
      </section>
    );
  }

  return (
    <section
      className={`grid min-h-0 min-w-0 overflow-hidden ${
        props.hideToggle
          ? "grid-cols-[minmax(0,1fr)]"
          : props.visible
          ? props.side === "left"
            ? "grid-cols-[minmax(0,1fr)_36px]"
            : "grid-cols-[36px_minmax(0,1fr)]"
          : "grid-cols-[36px]"
      }`}
      data-workspace-panel={props.side}
      data-workspace-panel-collapsed={!props.visible || undefined}
      data-workspace-panel-expanded={props.workspaceExpanded || undefined}
      data-workspace-panel-suppressed={props.suppressed || undefined}
    >
      <div
        id={props.controls}
        aria-label={props.label}
        aria-hidden={!props.visible || props.suppressed}
        className={`h-full min-h-0 min-w-0 overflow-hidden ${
          props.visible && !props.suppressed ? props.side === "right" ? "order-2" : "order-1" : "hidden"
        } ${props.contentClassName ?? ""}`}
        role="region"
      >
        {props.content}
      </div>
      {props.hideToggle ? null : (
        <div className={`${props.visible && props.side === "left" ? "order-2" : "order-1"} flex min-w-0 justify-center`}>
          <WorkspacePanelToggle
            controls={props.controls}
            label={props.label}
            side={props.side}
            visible={props.visible}
            onToggle={props.onToggle}
          />
        </div>
      )}
    </section>
  );
}
