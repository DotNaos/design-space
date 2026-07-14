import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import type { DesignDocument } from "../../shared/design-document";
import type { TargetModule } from "../../shared/target-module";
import { useDocumentItemEditor } from "./use-document-item-editor";

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
