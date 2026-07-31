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
