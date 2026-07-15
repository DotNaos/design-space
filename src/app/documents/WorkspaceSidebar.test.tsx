import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import { WorkspaceSidebar } from "./WorkspaceSidebar";

afterEach(cleanup);

const entries = [
  { id: "dashboard", label: "Dashboard", kind: "screen" as const },
  { id: "settings", label: "Settings", kind: "screen" as const },
  { id: "card", label: "Card", kind: "component" as const },
];

function renderSidebar(overrides: Partial<Parameters<typeof WorkspaceSidebar>[0]> = {}) {
  const props: Parameters<typeof WorkspaceSidebar>[0] = {
    active: "tree",
    activeDocumentId: "dashboard",
    canCreate: true,
    entries,
    layers: <p>Card layer</p>,
    mode: "app",
    projectLabel: "Design Space Demo Target",
    onChange: vi.fn(),
    onCreate: vi.fn(),
    onDocumentSelect: vi.fn(),
    onModeChange: vi.fn(),
    ...overrides,
  };
  render(<WorkspaceSidebar {...props} />);
  return props;
}

it("keeps Root, Pages, devices, Components, and Layers in one stable hierarchy", async () => {
  const props = renderSidebar();

  expect(screen.getByRole("heading", { name: "App" })).toBeVisible();
  expect(screen.getByText("Root")).toBeVisible();
  expect(screen.getByRole("region", { name: "Desktop pages" })).toBeVisible();
  expect(screen.getByText("Tablet")).toBeVisible();
  expect(screen.getByText("Mobile")).toBeVisible();
  expect(screen.getAllByText("Not configured")).toHaveLength(2);
  expect(screen.getByRole("button", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByText("Card layer")).toBeVisible();

  await userEvent.click(screen.getByRole("button", { name: "Settings" }));
  expect(props.onDocumentSelect).toHaveBeenCalledWith("settings");

  await userEvent.click(screen.getByRole("button", { name: "Components" }));
  expect(props.onModeChange).toHaveBeenCalledWith("library");
  expect(within(screen.getByRole("region", { name: "Project components" })).getByRole("button", { name: "Card" })).toBeVisible();
});

it("renders the file explorer as a dedicated navigation area with a mobile return", async () => {
  const props = renderSidebar({ active: "files", auxiliary: <div aria-label="Allowlisted files">src/App.tsx</div> });

  expect(screen.getByRole("heading", { name: "Files" })).toBeVisible();
  expect(screen.getByLabelText("Allowlisted files")).toHaveTextContent("src/App.tsx");
  expect(screen.queryByText("Card layer")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Back to App" }));
  expect(props.onChange).toHaveBeenCalledWith("tree");
});

it("opens the real component catalog from the persistent library connection", async () => {
  const props = renderSidebar();
  await userEvent.click(screen.getByRole("button", { name: /Component library/ }));
  expect(props.onChange).toHaveBeenCalledWith("catalog");
});
