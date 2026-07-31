import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("../components/PreviewCanvas/PreviewCanvas", () => ({
  PreviewCanvas: (props: {
    preview: React.ReactNode;
    toolbar?: React.ReactNode;
    worldHeader?: React.ReactNode;
  }) => (
    <div>
      {props.toolbar}
      {props.worldHeader}
      {props.preview}
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
        { active: false, id: "status", label: "status" },
        { active: true, id: "content", label: "content" },
        { active: false, id: "toolbar", label: "toolbar" },
      ]}
    >
      {() => <div>Preview</div>}
    </SourceCanvasViewport>,
  );

  const ancestry = screen.getByRole("navigation", { name: "Canvas ancestry" });
  expect(ancestry).toHaveTextContent("From root");
  expect(ancestry).toHaveTextContent("App");
  expect(ancestry).toHaveTextContent("WorkspaceShell");
  expect(ancestry).toHaveTextContent("slot:content");
  expect(screen.getByText("slot:content").closest("[aria-current]"))
    .toHaveAttribute("aria-current", "location");

  await userEvent.click(screen.getByRole("button", { name: /App/ }));
  expect(onSelectAncestry).toHaveBeenCalledWith({ id: "app", kind: "component", label: "App" });

  expect(screen.getByRole("button", { name: "content" })).toHaveAttribute("aria-pressed", "true");
  await userEvent.click(screen.getByRole("button", { name: "status" }));
  expect(onSelectSlot).toHaveBeenCalledWith({ active: false, id: "status", label: "status" });
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
