import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import type { DesignDocument } from "../../shared/design-document";
import type { TargetModule } from "../../shared/target-module";
import { runLocalOperation } from "../api";
import { useDocumentItemEditor } from "./use-document-item-editor";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return { ...actual, runLocalOperation: vi.fn() };
});

const runLocalOperationMock = vi.mocked(runLocalOperation);

beforeEach(() => {
  runLocalOperationMock.mockReset();
});

const target: TargetModule = {
  project: { id: "item-editor", label: "Item editor" },
  defaultAdapterId: "copy",
  defaultFixture: { instanceId: "copy.one", adapterId: "copy", slots: {} },
  files: [],
  adapters: [{
    component: { id: "copy", label: "Copy", group: "Content", slots: [] },
    controls: [{ id: "content", label: "Content", kind: "text", prop: "children" }],
    render: (props, context) => <p {...context.previewAttributes}>{String(props.children ?? "")}</p>,
  }],
};

const initialDocument: DesignDocument = {
  schemaVersion: 2,
  id: "screen.home",
  label: "Home",
  kind: "screen",
  root: { instanceId: "copy.one", adapterId: "copy", props: { children: "Initial" }, slots: {} },
};

const tailwindTarget: TargetModule = {
  project: { id: "tailwind-item-editor", label: "Tailwind item editor" },
  defaultAdapterId: "surface",
  defaultFixture: { instanceId: "surface.one", adapterId: "surface", slots: {} },
  files: [],
  adapters: [{
    component: { id: "surface", label: "Surface", group: "Layout", slots: [] },
    controls: [{ id: "style", label: "Classes", kind: "tailwind", prop: "className" }],
    render: (props, context) => <div {...context.previewAttributes} className={String(props.className ?? "")} />,
  }],
};

const tailwindDocument: DesignDocument = {
  schemaVersion: 2,
  id: "screen.tailwind",
  label: "Tailwind screen",
  kind: "screen",
  root: { instanceId: "surface.one", adapterId: "surface", props: { className: "p-4" }, slots: {} },
};

it("closes a private item draft when a newer source snapshot arrives with the same ids", () => {
  const onCommit = vi.fn();
  const onSelect = vi.fn();
  const { result, rerender } = renderHook(
    ({ document, sourceSnapshotKey }: { document: DesignDocument; sourceSnapshotKey: string }) => useDocumentItemEditor({
      target,
      document,
      library: [],
      connected: true,
      sourceSnapshotKey,
      createId: () => "copy.next",
      onCommit,
      onSelect,
    }),
    { initialProps: { document: initialDocument, sourceSnapshotKey: "source-v1" } },
  );

  act(() => result.current.open("copy.one"));
  act(() => result.current.updateControl("children", "Private draft"));
  expect(result.current.model?.session.draft.root.props?.children).toBe("Private draft");

  rerender({
    document: { ...initialDocument, root: { ...initialDocument.root, props: { children: "External change" } } },
    sourceSnapshotKey: "source-v2",
  });

  expect(result.current.model).toBeUndefined();
  expect(onCommit).not.toHaveBeenCalled();
});

it("removes stale compiled CSS when the last Tailwind class is cleared in the same editor session", async () => {
  runLocalOperationMock.mockImplementation(async (operation) => {
    if (operation.type === "compile-tailwind") {
      return { value: operation.value, css: ".p-4{padding:1rem}" } as never;
    }
    throw new Error(`Unexpected operation ${operation.type}`);
  });

  render(<TailwindEditorHarness />);
  fireEvent.click(screen.getByRole("button", { name: "Open editor" }));

  await waitFor(() => expect(runLocalOperationMock).toHaveBeenCalledWith({
    type: "compile-tailwind",
    value: "p-4",
  }));
  await waitFor(() => expect(screen.getByTestId("item-preview-css")).toHaveTextContent(".p-4{padding:1rem}"));
  expect(screen.getByTestId("compile-state")).toHaveTextContent("tailwind:ready");

  fireEvent.click(screen.getByRole("button", { name: "Clear classes" }));

  await waitFor(() => expect(screen.getByTestId("compile-state")).toHaveTextContent("plain:ready"));
  expect(screen.getByTestId("item-preview-css")).toBeEmptyDOMElement();
  expect(runLocalOperationMock).toHaveBeenCalledTimes(1);
});

function TailwindEditorHarness() {
  const editor = useDocumentItemEditor({
    target: tailwindTarget,
    document: tailwindDocument,
    library: [],
    connected: true,
    sourceSnapshotKey: "source-v1",
    createId: () => "surface.next",
    onCommit: vi.fn(),
    onSelect: vi.fn(),
  });
  const model = editor.model;
  const compileState = !model
    ? "closed"
    : `${model.hasTailwind ? "tailwind" : "plain"}:${model.compilePending ? "pending" : model.compileError ? "error" : "ready"}`;

  return (
    <>
      <button type="button" onClick={() => editor.open("surface.one")}>Open editor</button>
      <button type="button" onClick={() => editor.updateControl("className", undefined)}>Clear classes</button>
      <style data-testid="item-preview-css">{model?.previewCss}</style>
      <output data-testid="compile-state">{compileState}</output>
    </>
  );
}
