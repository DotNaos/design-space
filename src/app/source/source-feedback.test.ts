import { expect, it } from "vitest";

import type { SourceWorkspaceEntry, SourceWorkspaceLayer } from "../../shared/source-workspace";
import { formatSourceFeedback, sourceFeedbackContext } from "./source-feedback";

const entry = {
  id: "component-button",
  label: "Button",
  relativePath: "src/components/Button.tsx",
  source: { end: 42, start: 12 },
} as SourceWorkspaceEntry;

it("formats selected layer source context for Codex", () => {
  const layer = {
    id: "button-label",
    kind: "html",
    label: "<span>",
    source: { end: 31, start: 29 },
  } as SourceWorkspaceLayer;
  const context = sourceFeedbackContext(entry, layer);

  expect(context).toMatchObject({
    id: "component-button:button-label",
    kind: "layer",
    label: "<span>",
    source: { end: 31, relativePath: "src/components/Button.tsx", start: 29 },
  });
  expect(formatSourceFeedback("Increase the contrast.", context)).toContain(
    "- Source: src/components/Button.tsx:29-31",
  );
});

it("uses the component definition when no layer is selected", () => {
  expect(sourceFeedbackContext(entry)).toMatchObject({
    id: "component:component-button",
    kind: "component",
    label: "Button",
  });
});

it("formats multiple spatial annotations with source and canvas position", () => {
  const context = sourceFeedbackContext(entry)!;
  const message = formatSourceFeedback("Please apply these changes.", context, [
    {
      comment: "Increase the label contrast.",
      context,
      element: "<button>",
      id: "annotation-1",
      occurrence: 0,
      point: { x: 0.42, y: 0.67 },
    },
    {
      comment: "Tighten this spacing.",
      context,
      element: "<section>",
      id: "annotation-2",
      occurrence: 1,
      point: { x: 0.8, y: 0.2 },
    },
  ]);

  expect(message).toContain("Design Space annotations");
  expect(message).toContain("1. <button> — Increase the label contrast.");
  expect(message).toContain("Canvas point: 42% × 67%");
  expect(message).toContain("Rendered instance: 2");
});
