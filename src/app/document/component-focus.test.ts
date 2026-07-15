import { expect, it } from "vitest";

import type { DesignDocument } from "../../shared/design-document";
import { focusDocumentOnComponent } from "./component-focus";

const document: DesignDocument = {
  schemaVersion: 2,
  id: "screen.dashboard",
  label: "Dashboard",
  kind: "screen",
  root: {
    instanceId: "page.root",
    adapterId: "stack",
    slots: {
      content: [{
        kind: "component",
        node: { instanceId: "card.one", adapterId: "card", slots: { body: [] } },
      }],
    },
  },
};

it("focuses an existing component without changing the source document identity", () => {
  const focused = focusDocumentOnComponent(document, "card.one");

  expect(focused).toMatchObject({ id: "screen.dashboard", kind: "screen", root: { instanceId: "card.one" } });
  expect(document.root?.instanceId).toBe("page.root");
});

it("keeps the page unchanged when the requested component no longer exists", () => {
  expect(focusDocumentOnComponent(document, "missing")).toBe(document);
});
