import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import type { SelectionTarget } from "../../model";
import type { DesignDocument } from "../../shared/design-document";
import type { TargetModule } from "../../shared/target-module";
import { useDocumentSelectionInteractions } from "./use-document-selection-interactions";

it("clears transient action state when a different document loads", async () => {
  const onSelect = vi.fn();
  const { result, rerender } = renderHook(({ document }: { document: DesignDocument }) => (
    useDocumentSelectionInteractions(options(document, { kind: "component", id: document.root.instanceId }, onSelect))
  ), { initialProps: { document: screenDocument } });

  act(() => result.current.deleteSelection({ kind: "component", id: screenDocument.root.instanceId }));
  expect(result.current.actionError).toBe("The root component cannot be removed.");

  act(() => result.current.openContextMenu({
    selection: { kind: "component", id: screenDocument.root.instanceId },
    clientPosition: { x: 24, y: 30 },
    viewportPosition: { x: 4, y: 6 },
  }));
  expect(result.current.contextMenu).toMatchObject({ label: "Component" });

  rerender({ document: nextScreenDocument });
  await waitFor(() => {
    expect(result.current.actionError).toBeUndefined();
    expect(result.current.contextMenu).toBeUndefined();
  });
});

it("applies component deletion, closes the editor, and selects the parent", () => {
  const edit = vi.fn();
  const close = vi.fn();
  const onSelect = vi.fn();
  const { result } = renderHook(() => useDocumentSelectionInteractions({
    ...options(screenWithChild, { kind: "component", id: "child" }, onSelect),
    edit,
    itemEditor: { close } as never,
  }));

  act(() => result.current.deleteSelection({ kind: "component", id: "child" }));

  expect(edit).toHaveBeenCalledWith(expect.objectContaining({
    root: expect.objectContaining({ slots: { content: [] } }),
  }));
  expect(close).toHaveBeenCalledOnce();
  expect(onSelect).toHaveBeenCalledWith({ kind: "component", id: "root" });
});

it("removes the exact authored slot selected by its outlet", () => {
  const edit = vi.fn();
  const selection: SelectionTarget = {
    kind: "slot-outlet",
    id: "outlet:body.outlet",
    outletId: "body.outlet",
    slotId: "body",
  };
  const { result } = renderHook(() => useDocumentSelectionInteractions({
    ...options(componentDocument, selection, vi.fn()),
    library: [componentDocument],
    edit,
  }));

  act(() => result.current.removeSlotDefinition?.());

  expect(edit).toHaveBeenCalledWith(expect.objectContaining({
    component: expect.objectContaining({ slots: [] }),
  }));
});

it("opens the catalog when an empty declared slot is selected", () => {
  const selection = contentSlot();
  const onSelect = vi.fn();
  const onOpenPicker = vi.fn();
  const { result } = renderHook(() => useDocumentSelectionInteractions({
    ...options(screenDocument, selection, onSelect),
    onOpenPicker,
  }));

  act(() => result.current.selectTarget(selection));

  expect(onSelect).toHaveBeenCalledWith(selection);
  expect(onOpenPicker).toHaveBeenCalledWith(selection);
});

it("inserts an allowed component and hands its new instance to the editor flow", () => {
  const edit = vi.fn();
  const onSelect = vi.fn();
  const onInserted = vi.fn();
  const selection = contentSlot();
  const { result } = renderHook(() => useDocumentSelectionInteractions({
    ...options(screenDocument, selection, onSelect),
    edit,
    onInserted,
  }));

  let inserted = false;
  act(() => { inserted = result.current.insertComponent("text", selection); });

  expect(inserted).toBe(true);
  expect(edit).toHaveBeenCalledWith(expect.objectContaining({
    root: expect.objectContaining({
      slots: { content: [expect.objectContaining({ kind: "component", node: expect.objectContaining({ instanceId: "created", adapterId: "text" }) })] },
    }),
  }));
  expect(onSelect).toHaveBeenCalledWith({ kind: "component", id: "created" });
  expect(onInserted).toHaveBeenCalledWith("created");
});

function options(document: DesignDocument, selection: SelectionTarget, onSelect: (selection: SelectionTarget) => void) {
  return {
    target,
    document,
    library: [document],
    files: [],
    slots: [],
    selection,
    insertMode: false,
    createId: () => "created",
    itemEditor: { close: vi.fn() } as never,
    edit: vi.fn(),
    onSelect,
    onEdit: vi.fn(),
    onOpenPicker: vi.fn(),
    onInserted: vi.fn(),
    onOpenSource: vi.fn(),
    onReveal: vi.fn(),
  };
}

function contentSlot(): Extract<SelectionTarget, { kind: "slot" }> {
  return {
    kind: "slot",
    id: "slot:root:content",
    componentInstanceId: "root",
    slotId: "content",
  };
}

const target: TargetModule = {
  project: { id: "test", label: "Test" },
  defaultAdapterId: "stack",
  defaultFixture: { instanceId: "root", adapterId: "stack", slots: { content: [] } },
  files: [],
  adapters: [
    {
      component: { id: "stack", label: "Stack", group: "Layout", slots: [{ id: "content", label: "Content" }] },
      render: () => null,
    },
    { component: { id: "text", label: "Text", group: "Content", slots: [] }, render: () => null },
  ],
};

const screenDocument: DesignDocument = {
  schemaVersion: 2,
  id: "screen.one",
  label: "One",
  kind: "screen",
  root: { instanceId: "root", adapterId: "stack", slots: { content: [] } },
};

const nextScreenDocument: DesignDocument = {
  ...screenDocument,
  id: "screen.two",
  label: "Two",
  root: { ...screenDocument.root, instanceId: "next-root" },
};

const screenWithChild: DesignDocument = {
  ...screenDocument,
  root: {
    ...screenDocument.root,
    slots: { content: [{ kind: "component", node: { instanceId: "child", adapterId: "text", slots: {} } }] },
  },
};

const componentDocument: DesignDocument = {
  schemaVersion: 2,
  id: "component.panel",
  label: "Panel",
  kind: "component",
  component: {
    id: "panel",
    label: "Panel",
    group: "Surfaces",
    properties: [],
    slots: [{ id: "body", label: "Body" }],
  },
  root: {
    instanceId: "panel.root",
    adapterId: "stack",
    slots: { content: [{ kind: "slot-outlet", id: "body.outlet", slotId: "body" }] },
  },
};
