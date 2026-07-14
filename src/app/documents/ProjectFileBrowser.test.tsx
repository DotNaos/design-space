import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TargetFileEntry } from "../../shared/target-module";
import { ProjectFileBrowser } from "./ProjectFileBrowser";

afterEach(cleanup);

const files: readonly TargetFileEntry[] = [
  { id: "root", label: "demo-target", kind: "directory" },
  { id: "src", label: "src", kind: "directory", parentId: "root" },
  { id: "card", label: "Card.tsx", kind: "file", parentId: "src" },
  { id: "config", label: "design-space.config.tsx", kind: "file", parentId: "root" },
];

describe("ProjectFileBrowser", () => {
  it("renders the server-declared hierarchy and only selects file entries", async () => {
    const onSelect = vi.fn();
    render(<ProjectFileBrowser files={files} onSelect={onSelect} />);

    expect(screen.getByRole("treeitem", { name: /demo-target/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /Card.tsx/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /src/ }));
    expect(screen.queryByRole("button", { name: /Card.tsx/ })).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /src/ }));
    await userEvent.click(screen.getByRole("button", { name: /Card.tsx/ }));
    expect(onSelect).toHaveBeenCalledWith("card");
  });

  it("reveals every ancestor when an external source selection changes", async () => {
    const { rerender } = render(<ProjectFileBrowser files={files} onSelect={() => undefined} />);
    await userEvent.click(screen.getByRole("button", { name: /demo-target/ }));
    expect(screen.queryByRole("button", { name: /Card.tsx/ })).not.toBeInTheDocument();

    rerender(<ProjectFileBrowser files={files} selectedFileId="card" onSelect={() => undefined} />);
    expect(await screen.findByRole("button", { name: /Card.tsx/ })).toBeInTheDocument();
    expect(screen.getByRole("treeitem", { name: "Card.tsx" })).toHaveAttribute("aria-selected", "true");
  });
});
