import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { MobilePane } from "../shell/MobileDock";
import { DocumentWorkspaceSurface } from "./DocumentWorkspaceSurface";

const originalMatchMedia = window.matchMedia;

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Object.defineProperty(window, "matchMedia", { configurable: true, value: originalMatchMedia });
});

it("keeps the canvas mounted behind a closable mobile drawer without adding bottom navigation", async () => {
  render(<MobileSurfaceHarness />);

  expect(screen.getByTestId("canvas")).toBeVisible();
  expect(screen.getByRole("region", { name: "Component tree drawer" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Component tree" })).toBeVisible();
  expect(screen.getByText("Tree content")).toBeVisible();
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Close Component tree" }));

  expect(screen.queryByRole("region", { name: "Component tree drawer" })).not.toBeInTheDocument();
  expect(screen.getByTestId("canvas")).toBeVisible();
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
});

function MobileSurfaceHarness() {
  const [mobilePane, setMobilePane] = useState<MobilePane>("tree");

  return (
    <DocumentWorkspaceSurface
      canvas={<main data-testid="canvas">Canvas preview</main>}
      documentId="home"
      left={<div>Desktop project</div>}
      mobileInspect={<div>Inspector content</div>}
      mobilePane={mobilePane}
      mobileProject={<div>Project content</div>}
      mobileTree={<div>Tree content</div>}
      projectId="demo"
      right={<div>Desktop inspector</div>}
      onMobileDrawerClose={() => setMobilePane("canvas")}
    />
  );
}
