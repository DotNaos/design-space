import { describe, expect, it } from "vitest";

import type { RuntimeSourceWorkspace } from "../../shared/source-workspace";
import { initialSourceSelection, resolveSourceEntries } from "./source-workspace-selection";

const component = () => null;
const workspace = {
  runtime: "react",
  sourceRoot: "src/app",
  styles: [],
  entries: [
    { id: "layout-desktop", label: "Layout", area: "layout", device: "desktop", fileId: "layout-file", relativePath: "src/app/desktop/layout.tsx", exportName: "Layout", props: [], component },
    { id: "home-mobile", label: "Home", area: "pages", device: "mobile", fileId: "home-file", relativePath: "src/app/mobile/pages/home.tsx", exportName: "Home", props: [], component },
  ],
  devices: [
    { area: "layout", device: "desktop", path: "src/app/desktop/layout.tsx", state: "configured" },
    { area: "layout", device: "tablet", path: "src/app/tablet/layout.tsx", state: "fallback", fallback: "desktop" },
    { area: "layout", device: "mobile", path: "src/app/mobile/layout.tsx", state: "missing" },
  ],
} satisfies RuntimeSourceWorkspace;

describe("source workspace selection", () => {
  it("resolves an explicit Tablet fallback without relabelling the implementation", () => {
    const result = resolveSourceEntries(workspace, "layout", "tablet");
    expect(result).toMatchObject({ requestedDevice: "tablet", sourceDevice: "desktop", fallback: true });
    expect(result.entries.map((entry) => entry.id)).toEqual(["layout-desktop"]);
  });

  it("prefers the real desktop root for the initial preview", () => {
    expect(initialSourceSelection(workspace)).toMatchObject({ entry: { id: "layout-desktop" }, device: "desktop" });
  });
});
