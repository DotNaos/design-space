import type { Dispatch, ReactNode, SetStateAction } from "react";
import { ResizableWorkspacePanels } from "../shell/ResizableWorkspacePanels";
import type { MobilePane } from "../shell/MobileDock";
import { WorkspaceSidebarToggle } from "../shell/WorkspaceSidebarHeader";
import { SourceWorkspaceAreaTabs, type SourceWorkspaceActivity } from "./SourceWorkspaceAreaTabs";

interface SourceWorkspaceFrameProps {
  activity: SourceWorkspaceActivity;
  canvas: ReactNode;
  desktopLeft: ReactNode;
  dialogs: ReactNode;
  documentId: string;
  mobile: ReactNode;
  mobilePane: MobilePane;
  projectId: string;
  right: ReactNode;
  returnActivity: Exclude<SourceWorkspaceActivity, "files">;
  setMobilePane: Dispatch<SetStateAction<MobilePane>>;
  renderTopBar: (options?: { leadingAction?: ReactNode; trailingAction?: ReactNode }) => ReactNode;
  onActivityChange: (activity: SourceWorkspaceActivity) => void;
}

export function SourceWorkspaceFrame(props: SourceWorkspaceFrameProps) {
  return (
    <div className="flex h-dvh w-full min-w-0 overflow-hidden bg-[#0d0e10] text-zinc-200">
      <ResizableWorkspacePanels
        namespace={{ projectId: props.projectId, documentId: props.documentId }}
        left={{ label: "TypeScript app structure", content: props.desktopLeft, defaultWidth: 300, minWidth: 260, maxWidth: 880 }}
        right={{ label: "Component properties", content: props.right, defaultWidth: 480, minWidth: 360, maxWidth: 760 }}
        allowPanelExpansion={false}
        externalPanelControls
        leftHeader={({ controls, visible, onToggle }) => visible ? (
          <div className="flex h-12 shrink-0 items-center gap-1.5 border-b border-white/[0.08] bg-[#101113] px-1.5">
            <WorkspaceSidebarToggle controls={controls} label="project sidebar" visible onToggle={onToggle} />
            <SourceWorkspaceAreaTabs
              activity={props.activity}
              returnActivity={props.returnActivity}
              onActivityChange={props.onActivityChange}
            />
          </div>
        ) : null}
        rightHeader={({ controls, visible, onToggle }) => visible ? (
          <div className="flex h-12 shrink-0 items-center justify-end border-b border-white/[0.08] bg-[#101113] px-1.5">
            <WorkspaceSidebarToggle
              controls={controls}
              label="properties panel"
              side="right"
              visible
              onToggle={onToggle}
            />
          </div>
        ) : null}
        mobile={(
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {props.renderTopBar({
              leadingAction: (
                <WorkspaceSidebarToggle
                  label="mobile sidebar"
                  visible={props.mobilePane !== "canvas" && props.mobilePane !== "inspect"}
                  onToggle={() => props.setMobilePane((current) => current !== "canvas" && current !== "inspect" ? "canvas" : "tree")}
                />
              ),
              trailingAction: (
                <WorkspaceSidebarToggle
                  label="properties panel"
                  side="right"
                  visible={props.mobilePane === "inspect"}
                  onToggle={() => props.setMobilePane((current) => current === "inspect" ? "canvas" : "inspect")}
                />
              ),
            })}
            {props.mobile}
          </div>
        )}
        contentClassName="flex"
      >
        {({ left, right }) => (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {props.renderTopBar({
              leadingAction: left.visible ? undefined : (
                <WorkspaceSidebarToggle
                  controls={left.controls}
                  label="project sidebar"
                  visible={left.visible}
                  onToggle={left.onToggle}
                />
              ),
              trailingAction: right.visible ? undefined : (
                <WorkspaceSidebarToggle
                  controls={right.controls}
                  label="properties panel"
                  side="right"
                  visible={right.visible}
                  onToggle={right.onToggle}
                />
              ),
            })}
            <div className="flex min-h-0 min-w-0 flex-1">{props.canvas}</div>
          </div>
        )}
      </ResizableWorkspacePanels>
      {props.dialogs}
    </div>
  );
}
