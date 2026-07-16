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

const pageDesktop: RuntimeSourceWorkspaceEntry = {
  id: "page-dashboard-desktop",
  label: "Dashboard",
  area: "pages",
  device: "desktop",
  fileId: "file-dashboard-desktop",
  relativePath: "src/app/pages/desktop/Dashboard.tsx",
  exportName: "Dashboard",
  props: [],
  component: () => null,
};

const rootMobile: RuntimeSourceWorkspaceEntry = {
  ...pageDesktop,
  id: "root-mobile",
  label: "Mobile app root",
  area: "root",
  device: "mobile",
  fileId: "file-root-mobile",
  relativePath: "src/app/root/mobile/AppRoot.tsx",
  exportName: "AppRoot",
};

const states: readonly SourceWorkspaceDeviceState[] = [
  { area: "root", device: "desktop", path: "src/app/root/desktop", state: "missing" },
  { area: "root", device: "tablet", path: "src/app/root/tablet", state: "missing" },
  { area: "root", device: "mobile", path: "src/app/root/mobile", state: "configured" },
  { area: "pages", device: "desktop", path: "src/app/pages/desktop", state: "configured" },
  { area: "pages", device: "tablet", path: "src/app/pages/tablet", state: "fallback", fallback: "desktop" },
  { area: "pages", device: "mobile", path: "src/app/pages/mobile", state: "missing" },
  { area: "components", device: "desktop", path: "src/app/components/desktop", state: "missing" },
  { area: "components", device: "tablet", path: "src/app/components/tablet", state: "missing" },
  { area: "components", device: "mobile", path: "src/app/components/mobile", state: "missing" },
];

const workspace: RuntimeSourceWorkspace = {
  runtime: "react",
  sourceRoot: "src/app",
  devices: states,
  entries: [rootMobile, pageDesktop],
  styles: [],
};

it("shows the fixed area and device hierarchy with truthful configured, fallback, and missing states", () => {
  render(<SourceWorkspaceSidebar workspace={workspace} onSelect={() => undefined} />);

  expect(screen.getByRole("region", { name: "Root source" })).toBeVisible();
  expect(screen.getByRole("region", { name: "Pages source" })).toBeVisible();
  expect(screen.getByRole("region", { name: "Components source" })).toBeVisible();

  const mobileRoot = screen.getByRole("region", { name: "Root Mobile" });
  expect(mobileRoot).toHaveTextContent("Configured");
  expect(mobileRoot).toHaveTextContent("src/app/root/mobile");

  const tabletPages = screen.getByRole("region", { name: "Pages Tablet" });
  expect(tabletPages).toHaveTextContent("Uses Desktop");
  expect(tabletPages).toHaveTextContent("src/app/pages/tablet");
  expect(within(tabletPages).getByRole("button", { name: "Dashboard for Tablet" })).toBeVisible();

  const mobilePages = screen.getByRole("region", { name: "Pages Mobile" });
  expect(mobilePages).toHaveTextContent("Not configured");
  expect(mobilePages).toHaveTextContent("src/app/pages/mobile");
  expect(screen.getAllByText("Not configured")).toHaveLength(6);
});

it("selects the real source entry together with the requested device, including Tablet fallback", async () => {
  const onSelect = vi.fn();
  render(<SourceWorkspaceSidebar workspace={workspace} onSelect={onSelect} />);

  await userEvent.click(screen.getByRole("button", { name: "Dashboard for Tablet" }));
  expect(onSelect).toHaveBeenCalledWith({ device: "tablet", entryId: "page-dashboard-desktop" });

  await userEvent.click(screen.getByRole("button", { name: "Mobile app root for Mobile" }));
  expect(onSelect).toHaveBeenLastCalledWith({ device: "mobile", entryId: "root-mobile" });
});
