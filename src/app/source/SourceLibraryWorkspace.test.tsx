import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import type { LibraryRuntimeStatus } from "../../shared/contracts";
import type { SourceWorkspaceLibrary } from "../../shared/source-workspace";
import { SourceLibraryCanvas, SourceLibrarySidebar } from "./SourceLibraryWorkspace";

afterEach(cleanup);

const library: SourceWorkspaceLibrary = {
  packageName: "@dotnaos/react-ui",
  version: "^0.0.5",
  mode: "release",
  editable: false,
  components: [{ name: "Button", evidence: "package-export" }],
};

const stopped: LibraryRuntimeStatus = {
  packageName: "@dotnaos/react-ui",
  release: { version: "^0.0.5" },
  development: { configured: true, managed: false, state: "stopped" },
};

it("offers development startup and the installed package in the same sidebar", async () => {
  const start = vi.fn();
  const change = vi.fn();
  render(
    <SourceLibrarySidebar
      library={library}
      mode="development"
      pending={false}
      runtime={stopped}
      onModeChange={change}
      onSelect={vi.fn()}
      onStart={start}
      onStop={vi.fn()}
    />,
  );

  expect(screen.getByText("Stopped")).toBeVisible();
  expect(screen.getByText("^0.0.5 · Read only")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: /Start & use/ }));
  expect(start).toHaveBeenCalledOnce();
  await userEvent.click(screen.getByRole("button", { name: /Installed package/ }));
  expect(change).toHaveBeenCalledWith("release");
});

it("replaces the empty development canvas with a direct launcher", async () => {
  const start = vi.fn();
  render(
    <SourceLibraryCanvas
      library={library}
      mode="development"
      pending={false}
      runtime={stopped}
      onModeChange={vi.fn()}
      onStart={start}
      onStop={vi.fn()}
    />,
  );

  expect(screen.getByRole("heading", { name: "Development library is stopped" })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Start development library" }));
  expect(start).toHaveBeenCalledOnce();
  expect(screen.getByRole("button", { name: /Use installed version/ })).toBeVisible();
});

it("embeds a running development library in the canvas", () => {
  render(
    <SourceLibraryCanvas
      library={library}
      mode="development"
      pending={false}
      runtime={{ ...stopped, development: { configured: true, managed: false, state: "running", url: "http://dotnaos-ui-storybook.localhost:1355", components: [{ id: "button--primary", label: "Primary", group: "Primitives/Button" }] } }}
      onModeChange={vi.fn()}
      onStart={vi.fn()}
      onStop={vi.fn()}
    />,
  );

  expect(screen.getByTitle("Development preview: Primary")).toHaveAttribute("src", "http://dotnaos-ui-storybook.localhost:1355/iframe.html?id=button--primary&viewMode=story");
});
