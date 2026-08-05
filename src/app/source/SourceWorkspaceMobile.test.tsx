import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SourceWorkspaceMobile } from "./SourceWorkspaceMobile";

afterEach(cleanup);

function renderMobile(overrides: Partial<Parameters<typeof SourceWorkspaceMobile>[0]> = {}) {
  const props: Parameters<typeof SourceWorkspaceMobile>[0] = {
    activity: "app",
    appSidebar: <div>Structure tree</div>,
    canvas: <div>Canvas view</div>,
    left: <div>Project panel</div>,
    mobilePane: "canvas",
    returnActivity: "app",
    right: <div>Inspector panel</div>,
    onActivityChange: vi.fn(),
    onPaneChange: vi.fn(),
    ...overrides,
  };
  const view = render(<SourceWorkspaceMobile {...props} />);
  return { props, view };
}

describe("SourceWorkspaceMobile", () => {
  it("leaves the sidebar trigger in the top chrome instead of floating it over the canvas", () => {
    renderMobile();

    expect(screen.queryByRole("navigation", { name: "Mobile workspace tools" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open mobile sidebar" })).not.toBeInTheDocument();
    expect(screen.getByText("Structure tree")).toBeInTheDocument();
    expect(screen.getByText("Canvas view")).toBeVisible();
  });

  it("keeps the active panel mounted while the drawer is closed", () => {
    const { props, view } = renderMobile();
    const tree = screen.getByText("Structure tree");

    view.rerender(<SourceWorkspaceMobile {...props} mobilePane="tree" />);

    expect(screen.getByText("Structure tree")).toBe(tree);
  });

  it("floats one compact drawer over the full-width main view and keeps only Files in its area navigation", async () => {
    const { props } = renderMobile({ mobilePane: "tree" });

    const sidebar = screen.getByRole("complementary", { name: "Mobile workspace sidebar" });
    expect(sidebar).toHaveAttribute("data-open", "true");
    expect(sidebar).toHaveClass("absolute");
    expect(sidebar.parentElement).toContainElement(document.querySelector("[data-mobile-main-view]"));
    expect(screen.getByText("Structure tree")).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Mobile workspace areas" })).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Mobile workspace areas" }).closest("header")).not.toBeNull();
    expect(screen.queryByRole("navigation", { name: "Mobile workspace areas" })?.closest("footer")).toBeNull();
    expect(screen.getByRole("button", { name: "Close mobile sidebar overlay" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Files" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Structure" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Inspect" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Library" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close mobile sidebar" }));
    expect(props.onPaneChange).toHaveBeenCalledWith("canvas");
  });

  it("closes the floating drawer from its backdrop", async () => {
    const { props } = renderMobile({ mobilePane: "tree" });

    await userEvent.click(screen.getByRole("button", { name: "Close mobile sidebar overlay" }));
    expect(props.onPaneChange).toHaveBeenCalledWith("canvas");
  });

  it("opens the inspector as a right-hand floating drawer", () => {
    renderMobile({ mobilePane: "inspect" });

    const sidebar = screen.getByRole("complementary", { name: "Mobile workspace sidebar" });
    expect(sidebar).toHaveAttribute("data-side", "right");
    expect(sidebar).toHaveClass("right-0", "border-l");
    expect(screen.getByText("Inspector panel")).toBeVisible();
    expect(screen.getByText("Structure tree").parentElement).toHaveClass("invisible");
    expect(screen.getByRole("button", { name: "Files" })).not.toHaveAttribute("aria-current");
  });

  it("opens Files without duplicating the app and library switch", async () => {
    const { props } = renderMobile({ mobilePane: "tree" });

    expect(screen.queryByRole("button", { name: "Design" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Preview" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Files" }));
    expect(props.onActivityChange).toHaveBeenCalledWith("files");
    expect(props.onPaneChange).toHaveBeenCalledWith("documents");
    expect(screen.queryByRole("button", { name: "Structure" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Library" })).not.toBeInTheDocument();
  });

  it("returns from Files to the current workspace surface", async () => {
    const { props } = renderMobile({ activity: "files", mobilePane: "documents", returnActivity: "library" });

    await userEvent.click(screen.getByRole("button", { name: "Files" }));

    expect(props.onActivityChange).toHaveBeenCalledWith("library");
    expect(props.onPaneChange).toHaveBeenCalledWith("documents");
  });

  it("keeps the Files control reachable in both tab directions", async () => {
    renderMobile({ mobilePane: "tree" });

    const close = screen.getByRole("button", { name: "Close mobile sidebar" });
    close.focus();
    await userEvent.tab({ shift: true });

    expect(screen.getByRole("button", { name: "Files" })).toHaveFocus();
  });

  it("shows the current library panel when the drawer opens from library", () => {
    renderMobile({ activity: "library", mobilePane: "tree", left: <div>Library explorer</div> });

    expect(screen.getByText("Library explorer")).toBeVisible();
    expect(screen.getByText("Structure tree").parentElement).toHaveClass("invisible");
    expect(screen.getByRole("button", { name: "Files" })).not.toHaveAttribute("aria-current");
  });
});
