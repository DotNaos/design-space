

import { RunningTargetSwitcher, type WorkspaceSurfaceNavigation } from "./RunningTargetSwitcher";
import { WorkspaceSidebarToggle } from "./WorkspaceSidebarToggle";

export function WorkspaceSidebarHeader(props: {
  controls: string;
  surfaceNavigation?: WorkspaceSurfaceNavigation;
  targetLabel: string;
  visible: boolean;
  onToggle: () => void;
  inline?: boolean;
}) {
  if (props.inline) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <WorkspaceSidebarToggle
          controls={props.controls}
          label="project sidebar"
          visible={props.visible}
          onToggle={props.onToggle}
        />
        <div className="min-w-0 flex-1">
          <RunningTargetSwitcher surfaceNavigation={props.surfaceNavigation} targetLabel={props.targetLabel} />
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-12 min-w-0 items-center gap-1 border-b border-white/[0.08] bg-[#101113] px-1.5">
      <WorkspaceSidebarToggle
        controls={props.controls}
        label="project sidebar"
        visible={props.visible}
        onToggle={props.onToggle}
      />
      {props.visible ? (
        <div className="min-w-0 flex-1">
          <RunningTargetSwitcher surfaceNavigation={props.surfaceNavigation} targetLabel={props.targetLabel} />
        </div>
      ) : null}
    </div>
  );
}

export { WorkspaceSidebarToggle } from "./WorkspaceSidebarToggle";
