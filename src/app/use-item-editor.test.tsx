import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { TargetModule } from "../shared/target-module";
import { collectTailwindValues, useItemEditor } from "./use-item-editor";

describe("item editor session", () => {
  it("compiles Tailwind values for every edited instance and target-owned property", () => {
    const target: TargetModule = {
      project: { id: "controls", label: "Controls" },
      defaultAdapterId: "root",
      defaultFixture: {
        instanceId: "root-instance",
        adapterId: "root",
        props: { className: "old-root" },
        slots: {
          content: [{
            kind: "component",
            node: { instanceId: "child", adapterId: "copy", props: { classes: "text-lg" }, slots: {} },
          }],
        },
      },
      files: [],
      adapters: [
        {
          component: { id: "root", label: "Root", group: "Layout", slots: [{ id: "content", label: "Content" }] },
          controls: [{ id: "root-style", label: "Classes", kind: "tailwind", prop: "className" }],
          render: (_props, context) => <main>{context.slotChildren.content}</main>,
        },
        {
          component: { id: "copy", label: "Copy", group: "Content", slots: [] },
          controls: [{ id: "copy-style", label: "Classes", kind: "tailwind", prop: "classes" }],
          render: () => <p>Copy</p>,
        },
      ],
    };

    expect(collectTailwindValues(target, target.defaultFixture, "bg-zinc-950")).toBe("bg-zinc-950 text-lg");
  });

  it("clears an optional number back to its adapter default", () => {
    const target: TargetModule = {
      project: { id: "optional-number", label: "Optional number" },
      defaultAdapterId: "grid",
      defaultFixture: { instanceId: "grid.one", adapterId: "grid", props: { columns: 3 }, slots: {} },
      files: [],
      adapters: [{
        component: { id: "grid", label: "Grid", group: "Layout", slots: [] },
        controls: [{ id: "columns", label: "Columns", kind: "number", prop: "columns" }],
        defaultProps: { columns: 2 },
        render: () => <div />,
      }],
    };
    const onCommitFixture = vi.fn();
    const { result } = renderHook(() => useItemEditor({
      target,
      fixture: target.defaultFixture,
      rootClassValue: "",
      connected: true,
      basePreviewCss: "",
      compositionCss: {},
      createId: () => "copy",
      onCommitFixture,
      onApplyRootClass: vi.fn(),
      onApplyCompositionCss: vi.fn(),
      onSelect: vi.fn(),
    }));

    act(() => result.current.open("grid.one"));
    expect(result.current.model?.controlValues.columns).toBe(3);
    act(() => result.current.updateControl("columns", undefined));
    expect(result.current.model?.controlValues.columns).toBe(2);
    act(() => result.current.apply());
    expect(onCommitFixture).toHaveBeenCalledWith(expect.objectContaining({ props: undefined }), expect.anything());
  });

  it("keeps a required number when no adapter default can replace it", () => {
    const target: TargetModule = {
      project: { id: "required-number", label: "Required number" },
      defaultAdapterId: "grid",
      defaultFixture: { instanceId: "grid.one", adapterId: "grid", props: { columns: 3 }, slots: {} },
      files: [],
      adapters: [{
        component: { id: "grid", label: "Grid", group: "Layout", slots: [] },
        controls: [{ id: "columns", label: "Columns", kind: "number", prop: "columns", required: true }],
        render: () => <div />,
      }],
    };
    const { result } = renderHook(() => useItemEditor({
      target,
      fixture: target.defaultFixture,
      rootClassValue: "",
      connected: true,
      basePreviewCss: "",
      compositionCss: {},
      createId: () => "copy",
      onCommitFixture: vi.fn(),
      onApplyRootClass: vi.fn(),
      onApplyCompositionCss: vi.fn(),
      onSelect: vi.fn(),
    }));

    act(() => result.current.open("grid.one"));
    act(() => result.current.updateControl("columns", undefined));

    expect(result.current.model?.controlValues.columns).toBe(3);
    expect(result.current.model?.session.draftFixture.props).toEqual({ columns: 3 });
  });

  it("keeps a required number when its adapter default violates the control range", () => {
    const target: TargetModule = {
      project: { id: "required-range", label: "Required range" },
      defaultAdapterId: "grid",
      defaultFixture: { instanceId: "grid.one", adapterId: "grid", props: { columns: 3 }, slots: {} },
      files: [],
      adapters: [{
        component: { id: "grid", label: "Grid", group: "Layout", slots: [] },
        controls: [{ id: "columns", label: "Columns", kind: "number", prop: "columns", required: true, min: 1, max: 4 }],
        defaultProps: { columns: 0 },
        render: () => <div />,
      }],
    };
    const { result } = renderHook(() => useItemEditor({
      target,
      fixture: target.defaultFixture,
      rootClassValue: "",
      connected: true,
      basePreviewCss: "",
      compositionCss: {},
      createId: () => "copy",
      onCommitFixture: vi.fn(),
      onApplyRootClass: vi.fn(),
      onApplyCompositionCss: vi.fn(),
      onSelect: vi.fn(),
    }));

    act(() => result.current.open("grid.one"));
    act(() => result.current.updateControl("columns", undefined));

    expect(result.current.model?.controlValues.columns).toBe(3);
    expect(result.current.model?.session.draftFixture.props).toEqual({ columns: 3 });
  });
});
