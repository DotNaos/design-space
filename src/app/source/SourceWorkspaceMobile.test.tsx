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
    expect(screen.getByText("Canvas view")).toBeVisible();
  });

  it("floats one compact drawer over the full-width main view and exposes its areas", async () => {
    const { props } = renderMobile({ mobilePane: "tree" });

    const sidebar = screen.getByRole("complementary", { name: "Mobile workspace sidebar" });
    expect(sidebar).toHaveAttribute("data-open", "true");
    expect(sidebar).toHaveClass("absolute");
    expect(sidebar.parentElement).toContainElement(document.querySelector("[data-mobile-main-view]"));
    expect(screen.getByText("Structure tree")).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Mobile workspace areas" })).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Mobile workspace areas" }).closest("footer")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Close mobile sidebar overlay" })).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Inspect" }));
    expect(props.onPaneChange).toHaveBeenCalledWith("inspect");
    await userEvent.click(screen.getByRole("button", { name: "Close mobile sidebar" }));
    expect(props.onPaneChange).toHaveBeenCalledWith("canvas");
  });

  it("closes the floating drawer from its backdrop", async () => {
    const { props } = renderMobile({ mobilePane: "tree" });

    await userEvent.click(screen.getByRole("button", { name: "Close mobile sidebar overlay" }));
    expect(props.onPaneChange).toHaveBeenCalledWith("canvas");
  });

  it("switches the drawer between structure, files, and library without page-mode tabs", async () => {
    const { props } = renderMobile({ mobilePane: "tree" });

    expect(screen.queryByRole("button", { name: "Design" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Preview" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Files" }));
    expect(props.onActivityChange).toHaveBeenCalledWith("files");
    expect(props.onPaneChange).toHaveBeenCalledWith("documents");
    await userEvent.click(screen.getByRole("button", { name: "Library" }));
    expect(props.onActivityChange).toHaveBeenCalledWith("library");
  });

  it("shows the current library panel when the drawer opens from library", () => {
    renderMobile({ activity: "library", mobilePane: "tree", left: <div>Library explorer</div> });

    expect(screen.getByText("Library explorer")).toBeVisible();
    expect(screen.queryByText("Structure tree")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Library" })).toHaveAttribute("aria-current", "page");
  });
});
