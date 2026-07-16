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

it("shows device roots with their layout and nested pages instead of a separate Root area", () => {
  render(<SourceWorkspaceSidebar workspace={workspace} onSelect={() => undefined} />);

  expect(screen.queryByRole("region", { name: "Root source" })).not.toBeInTheDocument();
  const desktop = screen.getByRole("region", { name: "Desktop app" });
  expect(desktop).toHaveTextContent("src/app/desktop");
  expect(within(desktop).getByRole("button", { name: "DesktopLayout for Desktop" })).toBeVisible();
  expect(within(desktop).getByLabelText("Pages Desktop")).toHaveTextContent("src/app/desktop/pages");

  const tablet = screen.getByRole("region", { name: "Tablet app" });
  expect(tablet).toHaveTextContent("Uses Desktop");
  expect(tablet).toHaveTextContent("src/app/tablet/pages");
  expect(within(tablet).getByRole("button", { name: "Dashboard for Tablet" })).toBeVisible();
});

it("lists each component once and switches between direct and fallback implementations", async () => {
  const onSelect = vi.fn();
  render(<SourceWorkspaceSidebar workspace={workspace} onSelect={onSelect} />);

  expect(screen.getAllByText("ProjectSummary")).toHaveLength(1);
  const component = screen.getByRole("region", { name: "Component ProjectSummary" });
  await userEvent.click(within(component).getByRole("button", {
    name: "ProjectSummary Tablet implementation, uses Desktop",
  }));
  expect(onSelect).toHaveBeenCalledWith({ device: "tablet", entryId: "summary-desktop" });

  await userEvent.click(within(component).getByRole("button", { name: "ProjectSummary Mobile implementation" }));
  expect(onSelect).toHaveBeenLastCalledWith({ device: "mobile", entryId: "summary-mobile" });
});

it("selects a nested page together with the requested fallback device", async () => {
  const onSelect = vi.fn();
  render(<SourceWorkspaceSidebar workspace={workspace} onSelect={onSelect} />);

  await userEvent.click(screen.getByRole("button", { name: "Dashboard for Tablet" }));
  expect(onSelect).toHaveBeenCalledWith({ device: "tablet", entryId: "page-dashboard-desktop" });
});
