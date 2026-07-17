import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { SourceCodeCanvas } from "./SourceCodeCanvas";
import type { SourceFileEditor } from "./useSourceFileEditor";

vi.mock("./MonacoSourceEditor", () => ({
  MonacoSourceEditor: (props: { readOnly: boolean; value: string; onChange: (value: string) => void }) => (
    <textarea
      aria-label="Source code"
      readOnly={props.readOnly}
      value={props.value}
      onChange={(event) => props.onChange(event.currentTarget.value)}
    />
  ),
}));

afterEach(cleanup);

it("connects the Monaco surface to the editable source draft", async () => {
  const setDraft = vi.fn();
  const editor = sourceEditor({ setDraft });
  render(<SourceCodeCanvas editable editor={editor} label="canvas-grid-types.ts" path="src/app/components/CanvasGrid/canvas-grid-types.ts" />);

  const source = await screen.findByRole("textbox", { name: "Source code" });
  expect(source).not.toHaveAttribute("readonly");
  expect(source).toHaveValue("export type Grid = 8;");
  fireEvent.change(source, { target: { value: "export type Grid = 4;" } });
  expect(setDraft).toHaveBeenCalledWith("export type Grid = 4;");
  expect(screen.getByText("Editable")).toBeInTheDocument();
});

it("keeps unregistered files read only", async () => {
  render(<SourceCodeCanvas editable={false} editor={sourceEditor()} label="package.json" />);

  expect(await screen.findByRole("textbox", { name: "Source code" })).toHaveAttribute("readonly");
  expect(screen.getByText("Read only")).toBeInTheDocument();
});

function sourceEditor(overrides: Partial<SourceFileEditor> = {}): SourceFileEditor {
  return {
    draft: "export type Grid = 8;",
    dirty: false,
    error: undefined,
    loading: false,
    prepared: undefined,
    saving: false,
    canUndo: false,
    canRedo: false,
    snapshot: {
      fileId: "file.grid",
      label: "src/app/components/CanvasGrid/canvas-grid-types.ts",
      source: "export type Grid = 8;",
      version: "version-1",
    },
    setDraft: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    reset: vi.fn(),
    prepare: vi.fn(async () => undefined),
    save: vi.fn(async () => undefined),
    clearPrepared: vi.fn(),
    ...overrides,
  };
}
