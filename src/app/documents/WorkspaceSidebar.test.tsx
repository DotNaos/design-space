import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import { WorkspaceSidebar } from "./WorkspaceSidebar";

afterEach(cleanup);

const entries = [
  { id: "dashboard", label: "Dashboard", kind: "screen" as const },
  { id: "settings", label: "Settings", kind: "screen" as const },
  { id: "card", label: "Card", kind: "component" as const },
];

it("keeps project, pages, and layers in one stable hierarchy", async () => {
  const onChange = vi.fn();
  const onDocumentSelect = vi.fn();
  render(
    <WorkspaceSidebar
      active="tree"
      activeDocumentId="dashboard"
      canCreate
      entries={entries}
      layers={<p>Card layer</p>}
      mode="app"
      projectLabel="Design Space Demo Target"
      onChange={onChange}
      onCreate={vi.fn()}
      onDocumentSelect={onDocumentSelect}
    />,
  );

  expect(screen.getByRole("heading", { name: "Design Space Demo Target" })).toBeVisible();
  expect(screen.getByRole("region", { name: "Pages" })).toBeVisible();
  expect(screen.getByRole("tab", { name: "Layers" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tab", { name: "Files" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByText("Card layer")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Documents" })).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Settings" }));
  expect(onDocumentSelect).toHaveBeenCalledWith("settings");

  await userEvent.click(screen.getByRole("tab", { name: "Files" }));
  expect(onChange).toHaveBeenCalledWith("files");
});

it("renders the file explorer inside its persistent sidebar tab", () => {
  render(
    <WorkspaceSidebar
      active="files"
      auxiliary={<div aria-label="Allowlisted files">src/App.tsx</div>}
      canCreate
      entries={entries}
      layers={<p>Card layer</p>}
      mode="app"
      projectLabel="Demo"
      onChange={vi.fn()}
      onCreate={vi.fn()}
      onDocumentSelect={vi.fn()}
    />,
  );

  expect(screen.getByRole("tab", { name: "Files" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByLabelText("Allowlisted files")).toHaveTextContent("src/App.tsx");
  expect(screen.queryByText("Card layer")).not.toBeInTheDocument();
});

it("shows secondary tools temporarily with a direct return to pages and layers", async () => {
  const onChange = vi.fn();
  render(
    <WorkspaceSidebar
      active="catalog"
      auxiliary={<p>Catalog entries</p>}
      canCreate
      entries={entries}
      layers={<p>Card layer</p>}
      mode="app"
      projectLabel="Demo"
      onChange={onChange}
      onCreate={vi.fn()}
      onDocumentSelect={vi.fn()}
    />,
  );

  expect(screen.getByText("Catalog entries")).toBeVisible();
  expect(screen.queryByText("Card layer")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Back to pages and layers" }));
  expect(onChange).toHaveBeenCalledWith("tree");
});
