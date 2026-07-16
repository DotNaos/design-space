import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import type {
  RuntimeSourceWorkspace,
  RuntimeSourceWorkspaceEntry,
  SourceWorkspaceDeviceState,
} from "../../shared/source-workspace";
import { SourceWorkspaceSidebar } from "./SourceWorkspaceSidebar";

afterEach(cleanup);

const desktopLayout: RuntimeSourceWorkspaceEntry = {
  id: "layout-desktop",
  label: "DesktopLayout",
  area: "layout",
  device: "desktop",
  fileId: "file-layout-desktop",
  relativePath: "src/app/desktop/layout.tsx",
  exportName: "default",
  props: [],
  component: () => null,
};

const desktopPage: RuntimeSourceWorkspaceEntry = {
  ...desktopLayout,
  id: "page-dashboard-desktop",
  label: "Dashboard",
  area: "pages",
  fileId: "file-dashboard-desktop",
  relativePath: "src/app/desktop/pages/Dashboard.tsx",
  exportName: "Dashboard",
};

const mobileLayout: RuntimeSourceWorkspaceEntry = {
  ...desktopLayout,
  id: "layout-mobile",
  label: "MobileLayout",
  device: "mobile",
  fileId: "file-layout-mobile",
  relativePath: "src/app/mobile/layout.tsx",
};

const summaryDesktop: RuntimeSourceWorkspaceEntry = {
  ...desktopLayout,
  id: "summary-desktop",
  label: "ProjectSummary",
  area: "components",
  fileId: "file-summary-desktop",
  relativePath: "src/app/components/ProjectSummary/desktop.tsx",
  exportName: "ProjectSummary",
};

const summaryMobile: RuntimeSourceWorkspaceEntry = {
  ...summaryDesktop,
  id: "summary-mobile",
  device: "mobile",
  fileId: "file-summary-mobile",
  relativePath: "src/app/components/ProjectSummary/mobile.tsx",
};

const states: readonly SourceWorkspaceDeviceState[] = [
  { area: "layout", device: "desktop", path: "src/app/desktop/layout.tsx", state: "configured" },
  { area: "layout", device: "tablet", path: "src/app/tablet/layout.tsx", state: "fallback", fallback: "desktop" },
  { area: "layout", device: "mobile", path: "src/app/mobile/layout.tsx", state: "configured" },
  { area: "pages", device: "desktop", path: "src/app/desktop/pages", state: "configured" },
  { area: "pages", device: "tablet", path: "src/app/tablet/pages", state: "fallback", fallback: "desktop" },
  { area: "pages", device: "mobile", path: "src/app/mobile/pages", state: "missing" },
  { area: "components", device: "desktop", path: "src/app/components/*/desktop.tsx", state: "configured" },
  { area: "components", device: "tablet", path: "src/app/components/*/tablet.tsx", state: "fallback", fallback: "desktop" },
  { area: "components", device: "mobile", path: "src/app/components/*/mobile.tsx", state: "configured" },
];

const workspace: RuntimeSourceWorkspace = {
  runtime: "react",
  sourceRoot: "src/app",
  devices: states,
  entries: [desktopLayout, mobileLayout, desktopPage, summaryDesktop, summaryMobile],
  styles: [],
};

it("shows one logical tree with layout, pages, and components", () => {
  render(<SourceWorkspaceSidebar workspace={workspace} onSelect={() => undefined} />);

  const tree = screen.getByRole("tree", { name: "App source tree" });
  expect(within(tree).getByRole("region", { name: "Layout source" })).toBeVisible();
  expect(within(tree).getByRole("region", { name: "Pages source" })).toBeVisible();
  expect(within(tree).getByRole("region", { name: "Components source" })).toBeVisible();
  expect(screen.queryByRole("region", { name: "Desktop app" })).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Tablet app" })).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Mobile app" })).not.toBeInTheDocument();
  expect(within(tree).getByRole("button", { name: "App layout" })).toBeVisible();
  expect(within(tree).getByRole("button", { name: "Dashboard" })).toBeVisible();
});

it("lists every component once and keeps all implementation states visible", () => {
  const onSelect = vi.fn();
  render(<SourceWorkspaceSidebar workspace={workspace} onSelect={onSelect} />);

  expect(screen.getAllByText("ProjectSummary")).toHaveLength(1);
  const component = screen.getByRole("button", { name: "ProjectSummary" });
  expect(within(component).getByRole("img", {
    name: "Desktop implemented; Tablet uses Desktop; Mobile implemented",
  })).toBeVisible();
});

it("selects a logical node without changing the active canvas device", async () => {
  const onSelect = vi.fn();
  render(
    <SourceWorkspaceSidebar
      selected={{ device: "tablet", nodeId: "layout:app" }}
      workspace={workspace}
      onSelect={onSelect}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: "Dashboard" }));
  expect(onSelect).toHaveBeenCalledWith({ device: "tablet", nodeId: "pages:Dashboard" });
});
