import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import type { SourceWorkspaceLayer } from "../../shared/source-workspace";
import { useSourceLayerClassEditor } from "./useSourceLayerClassEditor";

afterEach(() => vi.restoreAllMocks());

it("applies a canvas class edit to the latest Monaco draft instead of the earlier selected source", () => {
  const initial = 'export const Panel = () => <section className="p-4">Panel</section>;';
  const monacoDraft = `// Kept from Monaco\n${initial}`;
  const setDraft = vi.fn();
  const initialLayer = layerFor(initial);
  const latestLayer = layerFor(monacoDraft);
  const editor = (draft: string) => ({
    draft,
    dirty: draft !== initial,
    loading: false,
    snapshot: { fileId: "panel", label: "Panel", source: initial, version: "v1" },
    setDraft,
    reset: vi.fn(),
  });
  const { result, rerender } = renderHook(
    ({ draft, layer }: { draft: string; layer: SourceWorkspaceLayer }) => useSourceLayerClassEditor({
      connected: false,
      editor: editor(draft),
      layer,
      scope: "library-development",
    }),
    { initialProps: { draft: initial, layer: initialLayer } },
  );

  rerender({ draft: monacoDraft, layer: latestLayer });
  act(() => result.current.change("p-6"));

  expect(setDraft).toHaveBeenLastCalledWith(
    '// Kept from Monaco\nexport const Panel = () => <section className="p-6">Panel</section>;',
  );
});

it("does not expose source classes as preview overrides until the user edits them", () => {
  const initial = 'export const Panel = () => <section className="p-4">Panel</section>;';
  const setDraft = vi.fn();
  const editor = (draft: string) => ({
    draft,
    dirty: draft !== initial,
    loading: false,
    snapshot: { fileId: "panel", label: "Panel", source: initial, version: "v1" },
    setDraft,
    reset: vi.fn(),
  });
  const { result, rerender } = renderHook(
    ({ draft }: { draft: string }) => useSourceLayerClassEditor({
      connected: false,
      editor: editor(draft),
      layer: layerFor(initial),
      scope: "app",
    }),
    { initialProps: { draft: initial } },
  );

  expect(result.current.value).toBe("p-4");
  expect(result.current.previewValue).toBeUndefined();
  expect(result.current.previewCss).toBe("");

  act(() => result.current.change("p-6"));
  const changed = setDraft.mock.lastCall?.[0] as string;
  rerender({ draft: changed });

  expect(result.current.previewValue).toBe("p-6");
});

it("clears a visual preview override when Monaco changes the draft independently", () => {
  const initial = 'export const Panel = () => <section className="p-4">Panel</section>;';
  const setDraft = vi.fn();
  const editor = (draft: string) => ({
    draft,
    dirty: draft !== initial,
    loading: false,
    snapshot: { fileId: "panel", label: "Panel", source: initial, version: "v1" },
    setDraft,
    reset: vi.fn(),
  });
  const { result, rerender } = renderHook(
    ({ draft }: { draft: string }) => useSourceLayerClassEditor({
      connected: false,
      editor: editor(draft),
      layer: layerFor(initial),
      scope: "app",
    }),
    { initialProps: { draft: initial } },
  );

  act(() => result.current.change("p-6"));
  rerender({ draft: setDraft.mock.lastCall?.[0] as string });
  expect(result.current.previewValue).toBe("p-6");

  rerender({ draft: `// Monaco edit\n${initial}` });
  expect(result.current.previewValue).toBeUndefined();
});

it("restores the visible class value when an external undo restores the source draft", () => {
  const initial = 'export const Panel = () => <section className="p-4">Panel</section>;';
  const setDraft = vi.fn();
  const editor = (draft: string) => ({
    draft,
    dirty: draft !== initial,
    loading: false,
    snapshot: { fileId: "panel", label: "Panel", source: initial, version: "v1" },
    setDraft,
    reset: vi.fn(),
  });
  const { result, rerender } = renderHook(
    ({ draft }: { draft: string }) => useSourceLayerClassEditor({
      connected: false,
      editor: editor(draft),
      layer: layerFor(initial),
      scope: "app",
    }),
    { initialProps: { draft: initial } },
  );

  act(() => result.current.change("p-6"));
  rerender({ draft: setDraft.mock.lastCall?.[0] as string });
  expect(result.current.value).toBe("p-6");

  rerender({ draft: initial });
  expect(result.current.value).toBe("p-4");
});

it("disables visual edits while the latest Monaco draft is still being analyzed", () => {
  const initial = 'export const Panel = () => <section className="p-4">Panel</section>;';
  const monacoDraft = `// Kept from Monaco\n${initial}`;
  const setDraft = vi.fn();
  const editor = {
    draft: monacoDraft,
    dirty: true,
    loading: false,
    snapshot: { fileId: "panel", label: "Panel", source: initial, version: "v1" },
    setDraft,
    reset: vi.fn(),
  };
  const { result, rerender } = renderHook(
    ({ layer, ready }: { layer: SourceWorkspaceLayer; ready: boolean }) => useSourceLayerClassEditor({
      connected: false,
      editor,
      layer,
      ready,
      scope: "library-development",
    }),
    { initialProps: { layer: layerFor(initial), ready: false } },
  );

  expect(result.current.editable).toBe(false);
  act(() => result.current.change("p-6"));
  expect(setDraft).not.toHaveBeenCalled();

  rerender({ layer: layerFor(monacoDraft), ready: true });
  act(() => result.current.change("p-6"));
  expect(setDraft).toHaveBeenCalledWith(
    '// Kept from Monaco\nexport const Panel = () => <section className="p-6">Panel</section>;',
  );
});

function layerFor(source: string): SourceWorkspaceLayer {
  const start = source.indexOf("className");
  return {
    id: "panel-section",
    label: "section",
    kind: "html",
    source: { start: source.indexOf("<section"), end: source.indexOf("</section>") + "</section>".length },
    className: { value: "p-4", start, end: start + 'className="p-4"'.length, syntax: "attribute" },
    children: [],
  };
}
