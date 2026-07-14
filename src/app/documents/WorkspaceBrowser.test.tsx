import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TargetDocumentEntry, TargetFileEntry } from "../../shared/target-module";
import type { DocumentAdapterView } from "../document/document-adapters";
import { WorkspaceBrowser, type WorkspaceBrowserView } from "./WorkspaceBrowser";

afterEach(cleanup);

const documents: readonly TargetDocumentEntry[] = [
  { id: "dashboard", label: "Dashboard", kind: "screen" },
  { id: "profile", label: "Profile summary", kind: "component" },
];
const files: readonly TargetFileEntry[] = [
  { id: "src", label: "src", kind: "directory" },
  { id: "dashboard-file", label: "Dashboard.tsx", kind: "file", parentId: "src" },
];
const targetAdapter = {
  component: { id: "target.card", label: "Card", group: "Layout", slots: [] },
  render: () => null,
};
const catalog: readonly DocumentAdapterView[] = [
  { component: targetAdapter.component, controls: [], defaultProps: {}, targetAdapter },
  { component: { id: "authored.profile", label: "Profile summary", group: "Product", slots: [] }, controls: [], defaultProps: {} },
];

describe("WorkspaceBrowser", () => {
  it("switches among the real document, file, and searchable catalog views", async () => {
    const onFileSelect = vi.fn();
    const onCatalogSelect = vi.fn();
    render(<Harness onFileSelect={onFileSelect} onCatalogSelect={onCatalogSelect} />);

    expect(screen.getByRole("button", { name: "Documents" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Dashboard" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Files" }));
    await userEvent.click(screen.getByRole("button", { name: /Dashboard.tsx/ }));
    expect(onFileSelect).toHaveBeenCalledWith("dashboard-file");

    await userEvent.click(screen.getByRole("button", { name: "Catalog" }));
    expect(screen.getByRole("button", { name: /Card Target Read only/ })).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox", { name: "Search component catalog" }), "profile");
    await userEvent.click(screen.getByRole("button", { name: /Profile summary Authored Editable/ }));
    expect(onCatalogSelect).toHaveBeenCalledWith("authored.profile");
  });
});

function Harness(props: { onFileSelect: (id: string) => void; onCatalogSelect: (id: string) => void }) {
  const [view, setView] = useState<WorkspaceBrowserView>("documents");
  return (
    <WorkspaceBrowser
      view={view}
      mode="app"
      entries={documents}
      files={files}
      catalogEntries={catalog}
      activeDocumentId="dashboard"
      canCreate
      onViewChange={setView}
      onModeChange={() => undefined}
      onDocumentSelect={() => undefined}
      onFileSelect={props.onFileSelect}
      onCatalogSelect={props.onCatalogSelect}
      onCreate={() => undefined}
    />
  );
}
