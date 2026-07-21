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
