import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { useSourceWorkspaceUiState } from "./useSourceWorkspaceUiState";

afterEach(cleanup);

it("opens a source workspace on the Design page by default", () => {
  function Probe() {
    const state = useSourceWorkspaceUiState({
      fileIds: new Set(),
      focusIds: new Set(),
      nodeIds: new Set(),
      projectId: `default-design-page-${Date.now()}`,
    });
    return <output>{state.workspaceMode}</output>;
  }

  render(<Probe />);
  expect(screen.getByText("design")).toBeVisible();
});
