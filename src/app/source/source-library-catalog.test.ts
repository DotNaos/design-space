import { expect, it } from "vitest";

import type {
  RuntimeSourceLibraryCatalog,
  RuntimeSourceWorkspace,
  RuntimeSourceWorkspaceEntry,
  SourceWorkspaceLibrary,
} from "../../shared/source-workspace";
import { filterSourceCatalog, sourceCatalogComponents } from "./source-library-catalog";

const entry = (
  options: Partial<RuntimeSourceWorkspaceEntry> & Pick<RuntimeSourceWorkspaceEntry, "id" | "label">,
): RuntimeSourceWorkspaceEntry => ({
  area: "components",
  component: () => null,
  device: "desktop",
  exportName: options.label,
  fileId: `file.${options.id}`,
  findings: [],
  props: [],
  relativePath: `src/app/components/${options.label}/index.tsx`,
  slots: [],
  source: { end: 10, start: 0 },
  ...options,
});

it("flattens logical app components without repeating device implementations", () => {
  const desktop = entry({ id: "summary.desktop", label: "ProjectSummary" });
  const mobile = entry({
    id: "summary.mobile",
    label: "ProjectSummary",
    device: "mobile",
    relativePath: "src/app/components/ProjectSummary/mobile.tsx",
  });
  const workspace: RuntimeSourceWorkspace = {
    devices: [],
    entries: [desktop, mobile, entry({ area: "layout", id: "shell", label: "WorkspaceShell" })],
    runtime: "react",
    sourceRoot: "src/app",
    styles: [],
  };

  const components = sourceCatalogComponents({
    appWorkspace: workspace,
    device: "desktop",
    kind: "app",
    mode: "release",
  });

  expect(components.map((component) => component.label)).toEqual(["WorkspaceShell", "ProjectSummary"]);
});

it("categorizes and filters external library components", () => {
  const button = entry({
    id: "button",
    label: "Button",
    relativePath: "src/primitives/Button/index.tsx",
  });
  const chat = entry({ id: "chat", label: "AiChat" });
  const catalog: RuntimeSourceLibraryCatalog = {
    packageName: "@dotnaos/react-ui",
    release: { entries: [button, chat], styles: [], version: "0.0.5" },
  };
  const library: SourceWorkspaceLibrary = {
    components: [
      { category: "primitive", evidence: "package-export", name: "Button" },
      { category: "component", evidence: "package-export", name: "AiChat" },
    ],
    editable: false,
    mode: "release",
    packageName: "@dotnaos/react-ui",
    version: "0.0.5",
  };
  const components = sourceCatalogComponents({
    catalog,
    device: "desktop",
    kind: "library",
    library,
    mode: "release",
  });

  expect(filterSourceCatalog(components, "", "primitive").map((component) => component.label)).toEqual(["Button"]);
  expect(filterSourceCatalog(components, "chat", "all").map((component) => component.label)).toEqual(["AiChat"]);
});
