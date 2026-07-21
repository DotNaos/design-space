import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import type { RuntimeSourceWorkspace } from "../../shared/source-workspace";
import type { SourceCodeEditor } from "./SourceCodeCanvas";
import { useSourceDraftAnalysis } from "./useSourceDraftAnalysis";

const runLocalOperation = vi.hoisted(() => vi.fn());

vi.mock("../api", () => ({ runLocalOperation }));

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

it("blocks visual bindings immediately when the Monaco draft outruns its analysis", async () => {
  vi.useFakeTimers();
  runLocalOperation.mockResolvedValue({ fileId: "panel-file", components: [] });
  const { result, rerender } = renderHook(
    ({ draft }: { draft: string }) => useSourceDraftAnalysis(workspace, editor(draft)),
    { initialProps: { draft: original } },
  );

  expect(result.current).toMatchObject({ analyzing: false, ready: true });
  rerender({ draft: firstDraft });
  expect(result.current).toMatchObject({ analyzing: true, ready: false });

  await act(async () => vi.advanceTimersByTimeAsync(180));
  expect(result.current).toMatchObject({ analyzing: false, ready: true });

  rerender({ draft: secondDraft });
  expect(result.current).toMatchObject({ analyzing: true, ready: false });
});

const original = 'export const Panel = () => <section className="p-4" />;';
const firstDraft = `// First Monaco edit\n${original}`;
const secondDraft = `// Newer Monaco edit\n${firstDraft}`;

function editor(draft: string): SourceCodeEditor {
  return {
    draft,
    dirty: draft !== original,
    loading: false,
    snapshot: { fileId: "panel-file", label: "Panel", source: original, version: "v1" },
    setDraft: vi.fn(),
  };
}

const workspace: RuntimeSourceWorkspace = {
  runtime: "react",
  sourceRoot: "src/app",
  devices: [],
  styles: [],
  entries: [{
    id: "panel",
    label: "Panel",
    area: "components",
    device: "desktop",
    fileId: "panel-file",
    relativePath: "src/app/components/Panel.tsx",
    exportName: "Panel",
    props: [],
    slots: [],
    findings: [],
    source: { start: 0, end: original.length },
    component: () => null,
  }],
};
