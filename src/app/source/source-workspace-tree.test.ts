import { expect, it } from "vitest";

import type { RuntimeSourceWorkspace, RuntimeSourceWorkspaceEntry } from "../../shared/source-workspace";
import {
  findSourceTreeLayer,
  initialSourceTreeSelection,
  sourceTargetRootNodeId,
  sourceTreeNodes,
  sourceTreeRows,
  sharedSourceTreeRows,
  visibleSourceTreeRows,
} from "./source-workspace-tree";

const entry = (values: Partial<RuntimeSourceWorkspaceEntry> & Pick<RuntimeSourceWorkspaceEntry, "id" | "area" | "device" | "relativePath">): RuntimeSourceWorkspaceEntry => ({
  label: values.id,
  fileId: `file-${values.id}`,
  exportName: values.id,
  props: [],
  slots: [],
  findings: [],
  source: { start: 0, end: 1 },
  component: () => null,
  ...values,
});

const workspace: RuntimeSourceWorkspace = {
  runtime: "react",
  sourceRoot: "src/app",
  styles: [],
  entries: [
    entry({
      id: "DesktopLayout",
      area: "layout",
      device: "desktop",
      relativePath: "src/app/desktop/layout.tsx",
      uses: ["Dashboard"],
      layers: [{
        id: "layout-main",
        label: "main",
        kind: "html",
        source: { start: 1, end: 2 },
        children: [{ id: "layout-dashboard", label: "Dashboard", kind: "component", source: { start: 2, end: 3 }, children: [] }],
      }],
    }),
    entry({ id: "MobileLayout", area: "layout", device: "mobile", relativePath: "src/app/mobile/layout.tsx" }),
    entry({
      id: "Dashboard",
      area: "pages",
      device: "desktop",
      relativePath: "src/app/desktop/pages/Dashboard.tsx",
      uses: ["ProjectSummary"],
      layers: [{
        id: "dashboard-section",
        label: "section",
        kind: "html",
        source: { start: 1, end: 2 },
        children: [{ id: "dashboard-summary", label: "ProjectSummary", kind: "component", source: { start: 2, end: 3 }, children: [] }],
      }],
    }),
    entry({
      id: "SummaryDesktop",
      label: "ProjectSummary",
      exportName: "ProjectSummary",
      area: "components",
      device: "desktop",
      relativePath: "src/app/components/ProjectSummary/desktop.tsx",
      layers: [{
        id: "summary-article",
        label: "article",
        kind: "html",
        source: { start: 1, end: 2 },
        children: [{ id: "summary-heading", label: "h2", kind: "html", source: { start: 2, end: 3 }, children: [] }],
      }],
    }),
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

it("uses the exact manifest target root and exposes only declared implementations", () => {
  const manifestWorkspace: RuntimeSourceWorkspace = {
    adapter: "app-manifest",
    runtime: "react",
    sourceRoot: "clients/web",
    styles: [],
    devices: [],
    targets: [
      {
        id: "web",
        runtime: "react",
        sourceRoot: "clients/web",
        entrypoint: "clients/web/src/main.tsx",
        devices: [
          { id: "desktop", entryId: "WebApp", root: { source: "clients/web/src/App.tsx", export: "App" } },
          { id: "tablet", entryId: "WebApp", root: { source: "clients/web/src/App.tsx", export: "App" } },
        ],
      },
      {
        id: "native",
        runtime: "react-native",
        sourceRoot: "clients/mobile",
        entrypoint: "clients/mobile/index.ts",
        devices: [
          { id: "mobile", entryId: "NativeApp", root: { source: "clients/mobile/src/App.mobile.tsx", export: "default" } },
        ],
      },
    ],
    entries: [
      entry({
        id: "WebApp",
        label: "App",
        exportName: "App",
        targetId: "web",
        manifestDevices: ["desktop", "tablet"],
        area: "layout",
        device: "desktop",
        relativePath: "clients/web/src/App.tsx",
      }),
      entry({
        id: "NativeApp",
        label: "AppMobile",
        exportName: "default",
        targetId: "native",
        manifestDevices: ["mobile"],
        area: "layout",
        device: "mobile",
        relativePath: "clients/mobile/src/App.mobile.tsx",
      }),
    ],
  };
  const web = manifestWorkspace.targets![0]!;
  const webNodes = sourceTreeNodes(manifestWorkspace, "web");
  expect(webNodes.map(({ label }) => label)).toEqual(["App"]);
  expect(webNodes[0]?.availableDevices).toEqual(["desktop", "tablet"]);
  expect(webNodes[0]?.implementations.desktop.state).toBe("shared");
  expect(webNodes[0]?.implementations.mobile.entry).toBeUndefined();
  expect(initialSourceTreeSelection(webNodes, web)).toEqual({ nodeId: "layout:app", device: "desktop" });
  expect(sourceTargetRootNodeId(webNodes, web, "tablet")).toBe("layout:app");
  expect(sourceTargetRootNodeId(webNodes, web, "mobile")).toBeUndefined();

  expect(sourceTreeNodes(manifestWorkspace, "native").map(({ label }) => label)).toEqual(["AppMobile"]);
});

it("orders one composition tree from layout to page to referenced component", () => {
  expect(sourceTreeRows(sourceTreeNodes(workspace)).map((row) => [
    row.depth,
    row.node?.label ?? `<${row.layer?.label}>`,
  ])).toEqual([
    [0, "DesktopLayout"],
    [1, "<main>"],
    [2, "Dashboard"],
    [3, "<section>"],
    [4, "ProjectSummary"],
  ]);
  expect(sharedSourceTreeRows(sourceTreeNodes(workspace)).map((row) => [
    row.depth,
    row.node?.label ?? `<${row.layer?.label}>`,
  ])).toEqual([
    [0, "ProjectSummary"],
    [1, "<article>"],
    [2, "<h2>"],
  ]);
});

it("hides descendants of collapsed source and HTML branches", () => {
  const rows = sourceTreeRows(sourceTreeNodes(workspace));
  const dashboard = rows.find((row) => row.node?.label === "Dashboard");
  const main = rows.find((row) => row.layer?.label === "main");
  expect(dashboard).toBeDefined();
  expect(main).toBeDefined();

  expect(visibleSourceTreeRows(rows, new Set([dashboard!.key])).map((row) => (
    row.node?.label ?? row.layer?.label
  ))).toEqual(["DesktopLayout", "main", "Dashboard"]);
  expect(visibleSourceTreeRows(rows, new Set([main!.key])).map((row) => (
    row.node?.label ?? row.layer?.label
  ))).toEqual(["DesktopLayout", "main"]);
});

it("finds a nested authored HTML layer by its stable source id", () => {
  const dashboard = workspace.entries.find((candidate) => candidate.id === "Dashboard");
  expect(findSourceTreeLayer(dashboard?.layers, "dashboard-section")).toMatchObject({
    id: "dashboard-section",
    kind: "html",
    label: "section",
  });
  expect(findSourceTreeLayer(dashboard?.layers, "missing-layer")).toBeUndefined();
});
