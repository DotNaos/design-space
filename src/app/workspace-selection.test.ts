import { describe, expect, it } from "vitest";

import type { TargetModule } from "../shared/target-module";
import { usesDocumentWorkspace } from "./workspace-selection";

describe("workspace selection", () => {
  it("keeps legacy targets on the fixture workspace", () => {
    expect(usesDocumentWorkspace({} as TargetModule)).toBe(false);
  });

  it("opens the document workspace when a catalog is registered without a default", () => {
    const target = {
      documents: [{ id: "screen.home", label: "Home", kind: "screen" }],
    } as unknown as TargetModule;

    expect(usesDocumentWorkspace(target)).toBe(true);
  });

  it("treats an explicitly empty catalog or recipe catalog as document-workspace opt-in", () => {
    expect(usesDocumentWorkspace({ documents: [] } as unknown as TargetModule)).toBe(true);
    expect(usesDocumentWorkspace({ componentRecipes: [] } as unknown as TargetModule)).toBe(true);
  });
});
