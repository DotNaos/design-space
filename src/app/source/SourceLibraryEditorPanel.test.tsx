import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SourceWorkspaceEntry, SourceWorkspaceLayer } from "../../shared/source-workspace";
import { SourceLibraryEditorPanel } from "./SourceLibraryEditorPanel";
import type { SourceFileEditor } from "./useSourceFileEditor";
import type { SourceLayerClassEditor } from "./useSourceLayerClassEditor";

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

const entry: SourceWorkspaceEntry = {
  id: "button",
  label: "Button",
  area: "components",
  device: "desktop",
  fileId: "button-source",
  relativePath: "src/Button/index.tsx",
  exportName: "Button",
  props: [{ name: "tone", type: '"primary" | "quiet"', required: false, kind: "string" }],
  slots: [{ name: "icon", type: "ComponentSlot<typeof Icon>", required: false, multiple: false, accepts: ["Icon"], min: 0, max: 1 }],
  findings: [],
  source: { start: 10, end: 200 },
  design: { fileId: "button-design", relativePath: "src/Button/index.design.tsx" },
};

const layer: SourceWorkspaceLayer = {
  id: "button-element",
  label: "button",
  kind: "html",
  source: { start: 80, end: 150 },
  className: { value: "rounded px-3", start: 95, end: 107 },
  text: { value: "Save", start: 110, end: 114, syntax: "text" },
  children: [],
};

describe("SourceLibraryEditorPanel", () => {
  it("shows editable Monaco source and the compact code/design controls for development", async () => {
    const onActiveTabChange = vi.fn();
    const onCodeDocumentChange = vi.fn();
    renderPanel({ onActiveTabChange, onCodeDocumentChange });

    const source = await screen.findByRole("textbox", { name: "Source code" });
    expect(source).not.toHaveAttribute("readonly");
    expect(source).toHaveValue("export function Button() { return <button />; }");
    expect(screen.getByText("src/Button/index.tsx")).toBeVisible();
    expect(screen.getByRole("button", { name: "Code" })).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(screen.getByRole("button", { name: "Design" }));
    expect(onActiveTabChange).toHaveBeenCalledWith("design");
    await userEvent.click(screen.getByRole("button", { name: "Design file" }));
    expect(onCodeDocumentChange).toHaveBeenCalledWith("design");
  });

  it("opens the colocated design document in the editable Monaco surface", async () => {
    renderPanel({ codeDocument: "design" });

    expect(await screen.findByRole("textbox", { name: "Source code" })).toHaveValue("export default defineComponentDesign({});");
    expect(screen.getByText("Button design")).toBeVisible();
    expect(screen.getByText("src/Button/index.design.tsx")).toBeVisible();
    expect(screen.getByRole("button", { name: "Design file" })).toHaveAttribute("aria-pressed", "true");
  });

  it("uses the existing inspector for visual HTML editing and typed contracts", () => {
    const change = vi.fn();
    const changeText = vi.fn();
    renderPanel({
      activeTab: "design",
      selectedLayer: layer,
      styleEditor: styleEditor({ change, changeText }),
    });

    const inspector = screen.getByRole("complementary", { name: "TypeScript component contract" });
    expect(within(inspector).getByRole("region", { name: "Props" })).toHaveTextContent("tone");
    expect(within(inspector).getByRole("region", { name: "Slots" })).toHaveTextContent("icon");
    const classes = within(inspector).getByRole("combobox", { name: "className" });
    fireEvent.change(classes, { target: { value: "rounded-xl px-4" } });
    expect(change).toHaveBeenCalledWith("rounded-xl px-4");
    fireEvent.change(within(inspector).getByRole("textbox", { name: "Static text" }), { target: { value: "Continue" } });
    expect(changeText).toHaveBeenCalledWith("Continue");
  });

  it("keeps installed releases read only and supports the existing evidence fallback", () => {
    const view = renderPanel({ mode: "release" });

    expect(screen.getByRole("complementary", { name: "Read-only library release" })).toHaveTextContent("Read-only release");
    expect(screen.queryByRole("button", { name: "Code" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Source code" })).not.toBeInTheDocument();

    view.rerender(
      <SourceLibraryEditorPanel
        activeTab="code"
        codeDocument="source"
        designEditor={editor("design", "")}
        entry={entry}
        mode="release"
        releaseFallback={<aside aria-label="Existing release evidence">Package 0.0.5</aside>}
        sourceEditor={editor("source", "")}
        onActiveTabChange={() => undefined}
        onCodeDocumentChange={() => undefined}
      />,
    );
    expect(screen.getByRole("complementary", { name: "Existing release evidence" })).toHaveTextContent("Package 0.0.5");
  });
});

function renderPanel(overrides: Partial<React.ComponentProps<typeof SourceLibraryEditorPanel>> = {}) {
  return render(
    <SourceLibraryEditorPanel
      activeTab="code"
      codeDocument="source"
      designEditor={editor("button-design", "export default defineComponentDesign({});")}
      entry={entry}
      mode="development"
      selectedLayer={layer}
      sourceEditor={editor("button-source", "export function Button() { return <button />; }")}
      styleEditor={styleEditor()}
      onActiveTabChange={() => undefined}
      onCodeDocumentChange={() => undefined}
      {...overrides}
    />,
  );
}

function editor(fileId: string, source: string): SourceFileEditor {
  return {
    draft: source,
    dirty: false,
    error: undefined,
    loading: false,
    prepared: undefined,
    saving: false,
    canUndo: false,
    canRedo: false,
    snapshot: { fileId, label: fileId, source, version: "version-1" },
    setDraft: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    reset: vi.fn(),
    prepare: vi.fn(async () => undefined),
    save: vi.fn(async () => undefined),
    clearPrepared: vi.fn(),
  };
}

function styleEditor(overrides: Partial<SourceLayerClassEditor> = {}): SourceLayerClassEditor {
  return {
    binding: layer.className,
    change: vi.fn(),
    changeText: vi.fn(),
    css: "",
    editable: true,
    error: undefined,
    reset: vi.fn(),
    textBinding: layer.text,
    textEditable: true,
    textValue: "Save",
    value: "rounded px-3",
    ...overrides,
  };
}
