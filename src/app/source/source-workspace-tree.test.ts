import { expect, it } from "vitest";

import type { RuntimeSourceWorkspace, RuntimeSourceWorkspaceEntry } from "../../shared/source-workspace";
import { initialSourceTreeSelection, sourceTreeNodes } from "./source-workspace-tree";

const entry = (values: Partial<RuntimeSourceWorkspaceEntry> & Pick<RuntimeSourceWorkspaceEntry, "id" | "area" | "device" | "relativePath">): RuntimeSourceWorkspaceEntry => ({
  label: values.id,
  fileId: `file-${values.id}`,
  exportName: values.id,
  props: [],
  component: () => null,
  ...values,
});

const workspace: RuntimeSourceWorkspace = {
  runtime: "react",
  sourceRoot: "src/app",
  styles: [],
  entries: [
    entry({ id: "DesktopLayout", area: "layout", device: "desktop", relativePath: "src/app/desktop/layout.tsx" }),
    entry({ id: "MobileLayout", area: "layout", device: "mobile", relativePath: "src/app/mobile/layout.tsx" }),
    entry({ id: "Dashboard", area: "pages", device: "desktop", relativePath: "src/app/desktop/pages/Dashboard.tsx" }),
    entry({ id: "SummaryDesktop", label: "ProjectSummary", exportName: "ProjectSummary", area: "components", device: "desktop", relativePath: "src/app/components/ProjectSummary/desktop.tsx" }),
  ],
  devices: [
    { area: "layout", device: "desktop", path: "src/app/desktop/layout.tsx", state: "configured" },
    { area: "layout", device: "tablet", path: "src/app/tablet/layout.tsx", state: "fallback", fallback: "desktop" },
    { area: "layout", device: "mobile", path: "src/app/mobile/layout.tsx", state: "configured" },
    { area: "pages", device: "desktop", path: "src/app/desktop/pages", state: "configured" },
    { area: "pages", device: "tablet", path: "src/app/tablet/pages", state: "fallback", fallback: "desktop" },
    { area: "pages", device: "mobile", path: "src/app/mobile/pages", state: "missing" },
    { area: "components", device: "desktop", path: "src/app/components/*/desktop.tsx", state: "configured" },
    { area: "components", device: "tablet", path: "src/app/components/*/tablet.tsx", state: "fallback", fallback: "desktop" },
    { area: "components", device: "mobile", path: "src/app/components/*/mobile.tsx", state: "missing" },
  ],
};

it("overlays device implementations on one logical node", () => {
  const nodes = sourceTreeNodes(workspace);
  const layout = nodes.find((node) => node.area === "layout");
  const summary = nodes.find((node) => node.label === "ProjectSummary");

  expect(nodes.filter((node) => node.area === "layout")).toHaveLength(1);
  expect(layout?.implementations.desktop.state).toBe("direct");
  expect(layout?.implementations.tablet).toMatchObject({ state: "fallback", sourceDevice: "desktop" });
  expect(layout?.implementations.mobile.state).toBe("direct");
  expect(summary?.implementations.tablet).toMatchObject({ state: "fallback", entry: { id: "SummaryDesktop" } });
  expect(summary?.implementations.mobile.state).toBe("missing");
});

it("starts with the desktop app layout when it exists", () => {
  expect(initialSourceTreeSelection(sourceTreeNodes(workspace))).toEqual({ nodeId: "layout:app", device: "desktop" });
});
