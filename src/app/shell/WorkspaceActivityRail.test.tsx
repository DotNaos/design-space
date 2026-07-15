import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import { WorkspaceActivityRail } from "./WorkspaceActivityRail";

afterEach(cleanup);

it("exposes the compact Variant A workspace areas and their current state", async () => {
  const onApp = vi.fn();
  const onLibrary = vi.fn();
  const onFiles = vi.fn();
  const onStrictUi = vi.fn();
  render(
    <WorkspaceActivityRail
      active="app"
      canStrictUi
      strictUiChecking={false}
      onApp={onApp}
      onFiles={onFiles}
      onLibrary={onLibrary}
      onStrictUi={onStrictUi}
    />,
  );

  expect(screen.getByRole("navigation", { name: "Workspace areas" })).toHaveClass("w-[52px]");
  expect(screen.getByRole("button", { name: "App" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("button", { name: "Assets — not registered by this target" })).toBeDisabled();

  await userEvent.click(screen.getByRole("button", { name: "Library" }));
  await userEvent.click(screen.getByRole("button", { name: "Files" }));
  await userEvent.click(screen.getByRole("button", { name: "Strict UI not checked" }));
  expect(onLibrary).toHaveBeenCalledOnce();
  expect(onFiles).toHaveBeenCalledOnce();
  expect(onStrictUi).toHaveBeenCalledOnce();
});
