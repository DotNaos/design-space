import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TargetFileEntry } from "../../shared/target-module";
import { runLocalOperation } from "../api";
import { ProjectFilesWorkspace } from "./ProjectFilesWorkspace";

vi.mock("../api", () => ({ runLocalOperation: vi.fn() }));

const runLocalOperationMock = vi.mocked(runLocalOperation);
const files: readonly TargetFileEntry[] = [
  { id: "src", label: "src", kind: "directory" },
  { id: "dashboard", label: "Dashboard.tsx", kind: "file", parentId: "src" },
];

beforeEach(() => runLocalOperationMock.mockReset());
afterEach(cleanup);

describe("ProjectFilesWorkspace", () => {
  it("opens the current source through the opaque registered file id and returns to the tree", async () => {
    runLocalOperationMock.mockResolvedValue({
      fileId: "dashboard",
      label: "Dashboard.tsx",
      source: "export function Dashboard() { return <main />; }",
      version: "source-v1",
    } as never);
    render(<ProjectFilesWorkspace files={files} />);

    fireEvent.click(screen.getByRole("button", { name: /Dashboard.tsx/ }));
    expect(runLocalOperationMock).toHaveBeenCalledWith({ type: "read-project-file", fileId: "dashboard" });
    expect(await screen.findByText(/export function Dashboard/)).toBeInTheDocument();
    expect(screen.getByText(/Read only · allowlisted source/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Back to project files" }));
    expect(screen.getByRole("tree", { name: "Allowlisted source files" })).toBeInTheDocument();
  });

  it("shows a clear unavailable state when a display entry is not registered for reading", async () => {
    const loadFile = () => {
      throw new Error("That project file is not registered.");
    };
    render(<ProjectFilesWorkspace files={files} loadFile={loadFile} />);

    fireEvent.click(screen.getByRole("button", { name: /Dashboard.tsx/ }));
    expect(await screen.findByText("Source unavailable")).toBeInTheDocument();
    expect(screen.getByText("That project file is not registered.")).toBeInTheDocument();
    expect(screen.getByText(/Only files explicitly registered/)).toBeInTheDocument();
  });
});
