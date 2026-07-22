import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState, useSyncExternalStore } from "react";
import { afterEach, expect, it, vi } from "vitest";

import type { ComponentDesignDefinition } from "../../shared/component-design";
import type { RuntimeSourceWorkspace, RuntimeSourceWorkspaceEntry } from "../../shared/source-workspace";
import { createMemorySourceDraftPersistence } from "./source-draft-persistence";
import { createSourceDraftWorkspace, sourceDraftDigest, sourceDraftKey } from "./source-draft-workspace";
import type { SourceDraftEntry } from "./source-draft-workspace";
import type { SourceDraftBase, SourceDraftLocation } from "./source-draft-workspace-types";
import { SourceChangeReviewModal } from "./SourceChangeReviewModal";
import { type SourceChangeReviewOptions, useSourceChangeReview } from "./useSourceChangeReview";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

vi.mock("./source-draft-local", () => ({
  preparedSourceDraftModuleUrl: () => `data:text/javascript,${encodeURIComponent(`
    export default {
      component: () => null,
      defaults: {},
      initialCase: "default",
      isStateful: false,
      cases: { default: {} },
      render: () => null,
      reviewEvidence: "visual class p-6; Monaco label Renamed"
    };
  `)}`,
}));

vi.mock("./SourcePreviewFrame", () => ({
  SourcePreviewFrame: (props: {
    entry?: RuntimeSourceWorkspaceEntry;
    selectedClassName?: string;
    selectedText?: string;
    styles?: readonly string[];
  }) => {
    const [evidence, setEvidence] = useState("Loading review preview");
    useEffect(() => {
      let active = true;
      void props.entry?.design?.load().then((definition) => {
        if (active) setEvidence(String((definition as PreparedReviewDefinition).reviewEvidence));
      });
      return () => { active = false; };
    }, [props.entry]);
    return (
      <div>
        {evidence}
        <output aria-label="Preview class">{props.selectedClassName}</output>
        <output aria-label="Preview text">{props.selectedText}</output>
        <output aria-label="Preview styles">{props.styles?.join("\n")}</output>
      </div>
    );
  },
}));

it("renders the complete prepared graph after a visual edit plus another Monaco edit", async () => {
  const workspace = sourceWorkspace();
  const change = draftEntry();
  const draftWorkspace = createSourceDraftWorkspace();
  const { result } = renderHook(() => useSourceChangeReview({
    appLabel: "Design Space",
    appVisual: { css: ".p-6{}", textValue: "Renamed", value: "p-6" },
    appWorkspace: workspace,
    changes: [change],
    draftWorkspace,
    libraryLabel: "UI",
    libraryVisual: { css: "", textValue: "", value: "" },
    libraryWorkspace: workspace,
  }));

  render(result.current.items[0]!.after.preview);

  expect(await screen.findByText("visual class p-6; Monaco label Renamed")).toBeVisible();
  expect(screen.getByLabelText("Preview class")).toHaveTextContent("p-6");
  expect(screen.getByLabelText("Preview styles")).toHaveTextContent(".p-6{}");
  expect(screen.queryByText("baseline class p-4; baseline label Save")).not.toBeInTheDocument();
});

it("renders a safe visual after-preview even while the coordinated code draft is invalid", async () => {
  const workspace = sourceWorkspace();
  const validChange = draftEntry();
  const change: SourceDraftEntry = {
    ...validChange,
    validation: { state: "invalid", draftDigest: validChange.draftDigest, message: "Strict UI rejected another file." },
  };
  const { result } = renderHook(() => useSourceChangeReview({
    appLabel: "Design Space",
    appVisual: { css: ".p-6{}", textValue: "Renamed", value: "p-6" },
    appWorkspace: workspace,
    changes: [change],
    draftWorkspace: createSourceDraftWorkspace(),
    libraryLabel: "UI",
    libraryVisual: { css: "", textValue: "", value: "" },
    libraryWorkspace: workspace,
  }));

  render(result.current.items[0]!.after.preview);

  expect(await screen.findByText("baseline class p-4; baseline label Save")).toBeVisible();
  expect(screen.getByLabelText("Preview class")).toHaveTextContent("p-6");
  expect(screen.getByLabelText("Preview styles")).toHaveTextContent(".p-6{}");
  expect(screen.queryByText(/cannot be executed safely/i)).not.toBeInTheDocument();
});

type PreparedReviewDefinition = ComponentDesignDefinition & { reviewEvidence: string };

function sourceWorkspace(): RuntimeSourceWorkspace {
  const entry: RuntimeSourceWorkspaceEntry = {
    id: "button",
    label: "Button",
    area: "components",
    device: "desktop",
    fileId: "button-source",
    relativePath: "src/Button/index.tsx",
    exportName: "Button",
    props: [],
    slots: [],
    findings: [],
    source: { start: 0, end: 100 },
    layers: [{
      id: "button-element",
      kind: "html",
      label: "button",
      source: { start: 25, end: 90 },
      className: { value: "p-4", start: 35, end: 51, syntax: "attribute" },
      children: [],
    }],
    component: () => null,
    design: {
      fileId: "button-design",
      relativePath: "src/Button/index.design.tsx",
      load: async () => ({
        component: () => null,
        defaults: {},
        initialCase: "default",
        isStateful: false,
        cases: { default: {} },
        render: () => null,
        reviewEvidence: "baseline class p-4; baseline label Save",
      } as PreparedReviewDefinition),
    },
  };
  return {
    runtime: "react",
    sourceRoot: "src",
    devices: [],
    entries: [entry],
    styles: [],
  };
}

function draftEntry(): SourceDraftEntry {
  const location = { scope: "app" as const, rootId: "design-space", fileId: "button-source" };
  const draftSource = 'export function Button() { return <button className="p-6">Renamed</button>; }';
  const draftDigest = sourceDraftDigest(draftSource);
  return {
    ...location,
    key: sourceDraftKey(location),
    label: "Button",
    path: "src/Button/index.tsx",
    baseSource: 'export function Button() { return <button className="p-4">Save</button>; }',
    baseVersion: "0".repeat(64),
    draftSource,
    draftDigest,
    history: [],
    future: [],
    validation: { state: "valid", draftDigest },
    stale: { state: "current" },
    approval: undefined,
    visualReview: {
      layerId: "button-element",
      previewEntryId: "button",
      className: "p-6",
      css: ".p-6{}",
    },
    selectedForReview: true,
    updatedAt: 1,
    dirty: true,
    approved: false,
  };
}

it("refuses to apply a newer unapproved cross-tab draft through an older review", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const { primary, secondary, reviewed } = await reviewedCrossTabDraft();
  const { result } = renderHook(() => useSourceChangeReview(reviewOptions(primary, reviewed)));
  const item = result.current.items[0]!;

  await publishNewerDraft(secondary);
  expect(primary.get(crossTabLocation)).toMatchObject({
    draftSource: "export function Panel() { return <main />; }",
    approved: false,
    validation: { state: "unvalidated" },
  });

  await act(async () => result.current.apply([item]));

  expect(fetch).not.toHaveBeenCalled();
  expect(result.current.error).toContain("review is out of date");
  expect(primary.get(crossTabLocation)?.draftSource).toBe("export function Panel() { return <main />; }");
});

it("keeps a newer cross-tab draft when an older reviewed digest is discarded", async () => {
  const { primary, secondary, reviewed } = await reviewedCrossTabDraft();
  const { result } = renderHook(() => useSourceChangeReview(reviewOptions(primary, reviewed)));
  const item = result.current.items[0]!;

  await publishNewerDraft(secondary);
  act(() => result.current.discard(item.id));

  expect(result.current.error).toContain("newer draft was kept");
  expect(primary.get(crossTabLocation)).toMatchObject({
    draftSource: "export function Panel() { return <main />; }",
    approved: false,
    validation: { state: "unvalidated" },
  });
});

it("keeps an exact-digest approval when the review closes and reopens", async () => {
  const workspace = createSourceDraftWorkspace();
  workspace.open(crossTabBase);
  workspace.edit(crossTabLocation, "export function Panel() { return <section />; }");
  workspace.setValidation(crossTabLocation, "valid");

  function ReviewHarness() {
    const snapshot = useSyncExternalStore(workspace.subscribe, workspace.getSnapshot, workspace.getSnapshot);
    const review = useSourceChangeReview(reviewOptions(workspace, snapshot.changes[0]!));
    return (
      <>
        <button type="button" onClick={review.show}>Open review</button>
        <SourceChangeReviewModal
          changes={review.items}
          initialState={review.state}
          open={review.open}
          onApply={() => undefined}
          onClose={review.close}
          onReviewStateChange={review.synchronize}
        />
      </>
    );
  }

  render(<ReviewHarness />);
  await userEvent.click(screen.getByRole("button", { name: "Open review" }));
  const approval = await screen.findByRole("checkbox", { name: "Approve Panel.tsx" });
  await userEvent.click(approval);
  expect(workspace.get(crossTabLocation)?.approved).toBe(true);

  await userEvent.click(screen.getByRole("button", { name: "Close review" }));
  await userEvent.click(screen.getByRole("button", { name: "Open review" }));
  expect(await screen.findByRole("checkbox", { name: "Approve Panel.tsx" })).toBeChecked();
});

const crossTabLocation: SourceDraftLocation = {
  scope: "app",
  rootId: "/project",
  fileId: "src/Panel.tsx",
};
const crossTabBase: SourceDraftBase = {
  ...crossTabLocation,
  label: "Panel.tsx",
  path: "src/Panel.tsx",
  baseSource: "export function Panel() { return null; }",
  baseVersion: "v1",
};

async function reviewedCrossTabDraft() {
  const persistence = createMemorySourceDraftPersistence();
  const primary = createSourceDraftWorkspace({ persistence });
  const secondary = createSourceDraftWorkspace({ persistence });
  await Promise.all([primary.hydrate(), secondary.hydrate()]);
  primary.open(crossTabBase);
  primary.edit(crossTabLocation, "export function Panel() { return <section />; }");
  primary.setValidation(crossTabLocation, "valid");
  primary.approve(crossTabLocation);
  await primary.flush();
  return { primary, secondary, reviewed: primary.get(crossTabLocation)! };
}

async function publishNewerDraft(workspace: ReturnType<typeof createSourceDraftWorkspace>) {
  workspace.edit(crossTabLocation, "export function Panel() { return <main />; }");
  await workspace.flush();
}

function reviewOptions(
  draftWorkspace: ReturnType<typeof createSourceDraftWorkspace>,
  reviewed: SourceDraftEntry,
): SourceChangeReviewOptions {
  const visual = { css: "", textValue: "", value: "" };
  const workspace = sourceWorkspace();
  return {
    appLabel: "App",
    appVisual: visual,
    appWorkspace: workspace,
    changes: [reviewed],
    draftWorkspace,
    libraryLabel: "Library",
    libraryVisual: visual,
    libraryWorkspace: workspace,
  };
}
