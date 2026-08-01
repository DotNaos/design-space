import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("../components/PreviewCanvas/PreviewCanvas", () => ({
  PreviewCanvas: (props: {
    pinWorldHeader?: boolean;
    preview: React.ReactNode;
    toolbar?: React.ReactNode;
    worldFooter?: React.ReactNode;
    worldHeader?: React.ReactNode;
  }) => (
    <div data-pin-world-header={props.pinWorldHeader || undefined}>
      {props.toolbar}
      {props.worldHeader}
      {props.preview}
      {props.worldFooter}
    </div>
  ),
}));

import { SourceCanvasViewport } from "./SourceCanvasViewport";

afterEach(cleanup);

it("switches between the selected screen and measured content bounds", async () => {
  render(
    <SourceCanvasViewport
      contentSize={{ height: 420, width: 360 }}
      device="desktop"
      onDeviceChange={vi.fn()}
    >
      {(frame) => <output>{`${frame.width} × ${frame.height}`}</output>}
    </SourceCanvasViewport>,
  );

  const screenFrame = document.querySelector<HTMLElement>("[data-preview-frame-mode]");
  expect(screenFrame).toHaveAttribute("data-preview-frame-mode", "screen");
  expect(screenFrame).toHaveClass("overflow-hidden");
  expect(screenFrame).toHaveStyle({ height: "800px", width: "1280px" });
  expect(screen.getByText("1280 × 800")).toBeVisible();

  await userEvent.click(screen.getByRole("button", { name: "Clip preview to selected screen" }));

  const contentFrame = document.querySelector<HTMLElement>("[data-preview-frame-mode]");
  expect(contentFrame).toHaveAttribute("data-preview-frame-mode", "content");
  expect(contentFrame).toHaveClass("overflow-visible");
  expect(contentFrame).toHaveStyle({ height: "420px", width: "360px" });
  expect(screen.getByText("360 × 420")).toBeVisible();
  expect(screen.getByRole("button", { name: "Hug preview content" })).toBeVisible();
});

it("wraps the selected screen in a device mockup without changing its viewport", async () => {
  render(
    <SourceCanvasViewport device="mobile" onDeviceChange={vi.fn()}>
      {(frame) => <output>{`${frame.width} × ${frame.height}`}</output>}
    </SourceCanvasViewport>,
  );

  expect(screen.queryByLabelText("phone device frame")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Show device mockup" }));
  expect(screen.getByLabelText("phone device frame")).toBeVisible();
  expect(screen.getByText("390 × 844")).toBeVisible();
  expect(screen.getByRole("button", { name: "Hide device mockup" })).toBeVisible();
});

it("attaches an interactive ancestry path to the canvas", async () => {
  const onSelectAncestry = vi.fn();
  const onSelectSlot = vi.fn();
  render(
    <SourceCanvasViewport
      ancestry={[
        { id: "app", kind: "component", label: "App" },
        { id: "shell", kind: "component", label: "WorkspaceShell" },
        { id: "content", kind: "slot", label: "slot:content" },
      ]}
      device="desktop"
      onDeviceChange={vi.fn()}
      onSelectAncestry={onSelectAncestry}
      onSelectSlot={onSelectSlot}
      slotOwnerLabel="WorkspaceShell"
      slotTabs={[
        { active: false, id: "status", label: "status", scope: "tree" },
        { active: true, id: "content", label: "content", scope: "tree" },
        { active: false, id: "toolbar", label: "toolbar", scope: "shared" },
      ]}
    >
      {() => <div>Preview</div>}
    </SourceCanvasViewport>,
  );

  const ancestry = screen.getByRole("navigation", { name: "Canvas ancestry" });
  expect(document.querySelector('[data-pin-world-header="true"]')).toContainElement(ancestry);
  expect(ancestry).toHaveTextContent("From root");
  expect(ancestry).toHaveTextContent("App");
  expect(ancestry).toHaveTextContent("WorkspaceShell");
  expect(ancestry).toHaveTextContent("slot:content");
  expect(screen.getByText("slot:content").closest("[aria-current]"))
    .toHaveAttribute("aria-current", "location");
  expect(document.querySelector("[data-preview-frame-mode]")).not.toHaveClass("shadow-2xl");

  await userEvent.click(screen.getByRole("button", { name: /App/ }));
  expect(onSelectAncestry).toHaveBeenCalledWith({ id: "app", kind: "component", label: "App" });

  expect(screen.getByRole("button", { name: "slot:content" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "slot:toolbar" })).toHaveAttribute("data-slot-scope", "shared");
  await userEvent.click(screen.getByRole("button", { name: "slot:status" }));
  expect(onSelectSlot).toHaveBeenCalledWith({ active: false, id: "status", label: "status", scope: "tree" });
});

it("collapses dense sibling slots into a compact picker", async () => {
  const onSelectSlot = vi.fn();
  render(
    <SourceCanvasViewport
      ancestry={[{ id: "workspace", kind: "component", label: "SourceWorkspace" }]}
      device="desktop"
      onDeviceChange={vi.fn()}
      onSelectSlot={onSelectSlot}
      slotOwnerLabel="SourceWorkspace"
      slotTabs={[
        { active: false, id: "sidebar", label: "sourceWorkspaceSidebar", scope: "tree" },
        { active: false, id: "canvas", label: "sourceCodeCanvas", scope: "tree" },
        { active: false, id: "browser", label: "projectFileBrowser", scope: "tree" },
        { active: false, id: "library", label: "sourceLibraryExplorer", scope: "tree" },
        { active: false, id: "overlay", label: "sourceWorkspaceCodeOverlay", scope: "shared" },
      ]}
    >
      {() => <div>Preview</div>}
    </SourceCanvasViewport>,
  );

  const picker = screen.getByRole("button", { name: "Choose child slot of SourceWorkspace · 5 slots" });
  expect(picker).toHaveTextContent("Slots5");
  expect(screen.queryByRole("menuitemradio", { name: /sourceWorkspaceCodeOverlay/ })).not.toBeInTheDocument();

  await userEvent.click(picker);
  const sharedSlot = await screen.findByRole("menuitemradio", { name: /sourceWorkspaceCodeOverlay/ });
  expect(sharedSlot).toHaveTextContent("Shared");
  await userEvent.click(sharedSlot);
  expect(onSelectSlot).toHaveBeenCalledWith({
    active: false,
    id: "overlay",
    label: "sourceWorkspaceCodeOverlay",
    scope: "shared",
  });
});

it("shows parent approval status only when supplied by approval review mode", () => {
  render(
    <SourceCanvasViewport
      ancestry={[
        {
          approval: { label: "Approved · App", tone: "approved" },
          id: "app",
          kind: "component",
          label: "App",
        },
        {
          approval: { label: "Awaiting approval · WorkspaceShell", tone: "pending" },
          id: "shell",
          kind: "component",
          label: "WorkspaceShell",
        },
        { id: "content", kind: "slot", label: "slot:content" },
      ]}
      device="desktop"
      onDeviceChange={vi.fn()}
      onSelectAncestry={vi.fn()}
    >
      {() => <div>Preview</div>}
    </SourceCanvasViewport>,
  );

  expect(screen.getByRole("button", { name: "App · Approved · App" }))
    .toHaveAttribute("data-approval-tone", "approved");
  expect(screen.getByRole("button", { name: "WorkspaceShell · Awaiting approval · WorkspaceShell" }))
    .toHaveAttribute("data-approval-tone", "pending");
  expect(screen.getByText("slot:content").closest("[data-approval-tone]"))
    .not.toBeInTheDocument();
});
