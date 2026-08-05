import { Button, Description, Dropdown, Header, Label, Separator } from "@heroui/react";
import { AppWindow, Check, ChevronDown, Library } from "lucide-react";

import { useRunningTargets } from "../use-running-targets";
import { WorkspaceItem } from "./WorkspaceItem";

export type WorkspaceSurface = "app" | "library";

export interface WorkspaceSurfaceNavigation {
  value: WorkspaceSurface;
  libraryLabel: string;
  onChange: (surface: WorkspaceSurface) => void;
}

export function RunningTargetSwitcher(props: {
  targetLabel: string;
  surfaceNavigation?: WorkspaceSurfaceNavigation;
}) {
  const targets = useRunningTargets();
  const currentTarget = targets.find((target) => target.current);
  const appLabel = currentTarget?.project.label ?? props.targetLabel;
  const currentSurface = props.surfaceNavigation?.value ?? "app";
  const libraryLabel = props.surfaceNavigation?.libraryLabel ?? "Component library";
  const primaryLabel = currentSurface === "library" ? "Library" : appLabel;
  const secondaryLabel = currentSurface === "library" ? libraryLabel : "App";
  const otherTargets = targets.filter((target) => !target.current);

  return (
    <Dropdown>
      <Button
        aria-label={`Current workspace: ${primaryLabel}, ${secondaryLabel}. Switch workspace`}
        className="h-9 min-w-0 max-w-full justify-start gap-2 rounded-lg px-2 text-zinc-100"
        size="sm"
        variant="ghost"
      >
        <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold tracking-tight">{primaryLabel}</span>
        <ChevronDown aria-hidden="true" className="shrink-0 text-zinc-600" size={12} />
      </Button>
      <Dropdown.Popover className="min-w-72 rounded-2xl border-0 bg-[#18191c] shadow-[0_18px_48px_rgba(0,0,0,0.42)]">
        <Dropdown.Menu
          aria-label="Design Space workspaces"
          onAction={(key) => {
            const id = String(key);
            if (id === "surface:app" || id === "surface:library") {
              props.surfaceNavigation?.onChange(id === "surface:library" ? "library" : "app");
              return;
            }
            const targetId = id.replace(/^target:/, "");
            const target = targets.find((candidate) => candidate.instanceId === targetId);
            if (target && !target.current) window.location.assign(target.url);
          }}
        >
          {props.surfaceNavigation ? (
            <Dropdown.Section>
              <Header className="px-2 pb-1 pt-1 text-[10px] font-medium text-zinc-500">
                {appLabel}
              </Header>
              <WorkspaceItem
                checked={currentSurface === "app"}
                description="Project source"
                icon={AppWindow}
                id="surface:app"
                label={appLabel}
                tone="app"
              />
              <WorkspaceItem
                checked={currentSurface === "library"}
                description={libraryLabel}
                icon={Library}
                id="surface:library"
                label="Library"
                tone="library"
              />
            </Dropdown.Section>
          ) : null}
          {props.surfaceNavigation && otherTargets.length ? <Separator /> : null}
          {otherTargets.length ? (
            <Dropdown.Section>
              <Header className="px-2 pb-1 pt-1 text-[10px] font-medium text-zinc-500">
                Other running apps
              </Header>
              {otherTargets.map((target) => (
                <Dropdown.Item id={`target:${target.instanceId}`} key={target.instanceId} textValue={target.project.label}>
                  <AppWindow aria-hidden="true" className="size-4 shrink-0 text-zinc-500" />
                  <div className="min-w-0 flex-1">
                    <Label className="truncate">{target.project.label}</Label>
                    <Description>Running locally</Description>
                  </div>
                </Dropdown.Item>
              ))}
            </Dropdown.Section>
          ) : null}
          {!props.surfaceNavigation && !otherTargets.length ? (
            <Dropdown.Item id={`target:${currentTarget?.instanceId ?? "current"}`} textValue={appLabel}>
              <AppWindow aria-hidden="true" className="size-4 shrink-0 text-sky-300" />
              <div className="min-w-0 flex-1">
                <Label className="truncate">{appLabel}</Label>
                <Description>Current app</Description>
              </div>
              <Check aria-hidden="true" className="size-4 text-emerald-400" />
            </Dropdown.Item>
          ) : null}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
