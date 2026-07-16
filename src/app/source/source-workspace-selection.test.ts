import { describe, expect, it } from "vitest";

import type { RuntimeSourceWorkspace } from "../../shared/source-workspace";
import { initialSourceSelection, resolveSourceEntries } from "./source-workspace-selection";

const component = () => null;
const workspace = {
  runtime: "react",
  sourceRoot: "src/app",
  styles: [],
  entries: [
    { id: "root-desktop", label: "Root", area: "root", device: "desktop", fileId: "root-file", relativePath: "src/app/root/desktop/index.tsx", exportName: "Root", props: [], component },
    { id: "home-mobile", label: "Home", area: "pages", device: "mobile", fileId: "home-file", relativePath: "src/app/pages/mobile/home.tsx", exportName: "Home", props: [], component },
  ],
  devices: [
    { area: "root", device: "desktop", path: "src/app/root/desktop", state: "configured" },
    { area: "root", device: "tablet", path: "src/app/root/tablet", state: "fallback", fallback: "desktop" },
    { area: "root", device: "mobile", path: "src/app/root/mobile", state: "missing" },
  ],
} satisfies RuntimeSourceWorkspace;

describe("source workspace selection", () => {
  it("resolves an explicit Tablet fallback without relabelling the implementation", () => {
    const result = resolveSourceEntries(workspace, "root", "tablet");
    expect(result).toMatchObject({ requestedDevice: "tablet", sourceDevice: "desktop", fallback: true });
    expect(result.entries.map((entry) => entry.id)).toEqual(["root-desktop"]);
  });

  it("prefers the real desktop root for the initial preview", () => {
    expect(initialSourceSelection(workspace)).toMatchObject({ entry: { id: "root-desktop" }, device: "desktop" });
  });
});
