import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import type { RuntimeSourceWorkspaceEntry } from "../../shared/source-workspace";
import { SourcePreviewFrame } from "./SourcePreviewFrame";

it("states that required TypeScript props are unset instead of inventing preview values", () => {
  const component = vi.fn(() => null);
  const entry = {
    id: "panel",
    label: "Panel",
    area: "components",
    device: "desktop",
    fileId: "panel-file",
    relativePath: "src/app/components/Panel/desktop.tsx",
    exportName: "Panel",
    props: [
      { name: "title", type: "string", required: true, kind: "string", slot: false },
      { name: "children", type: "ReactNode", required: false, kind: "unknown", slot: true, multiple: true },
    ],
    component,
  } satisfies RuntimeSourceWorkspaceEntry;

  render(<SourcePreviewFrame device="desktop" entry={entry} runtime="react" styles={[]} />);
  expect(screen.getByText("Preview arguments required")).toBeVisible();
  expect(screen.getByText(/Required props: title/)).toBeVisible();
  expect(component).not.toHaveBeenCalled();
});
