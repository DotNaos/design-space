import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { createTargetViewModel, renderTargetFixture } from "../../src/app/target-model";
import { validateStrictUi } from "../../src/model/strict-ui";
import type { DesignDocument } from "../../src/shared/design-document";
import type { ComponentFixture } from "../../src/shared/target-module";
import { target } from "./design-space.config";
import panelDocumentJson from "./src/panel.design.json";

afterEach(cleanup);

describe("demo target adapter evidence", () => {
  it("binds the expanded HTML tree to the real Card DOM", () => {
    const fixture: ComponentFixture = {
      instanceId: "review-card",
      adapterId: "card",
      slots: { header: [], body: [], footer: [] },
    };
    const cardTarget = { ...target, defaultFixture: fixture };
    const view = createTargetViewModel(cardTarget, true);
    expect(view.rows.filter((row) => row.kind === "html")).toMatchObject([
      { label: "article", selection: { id: "html:review-card:card.article" } },
      { label: "header", selection: { id: "html:review-card:card.header" } },
      { label: "div", selection: { id: "html:review-card:card.body" } },
      { label: "footer", selection: { id: "html:review-card:card.footer" } },
    ]);

    const { container } = render(<>{renderTargetFixture(cardTarget, fixture)}</>);
    for (const id of ["card.article", "card.header", "card.body", "card.footer"]) {
      expect(container.querySelector(`[data-design-space-html-id="html:review-card:${id}"]`)).toBeInTheDocument();
    }
  });

  it("keeps an explicitly null Card class unstyled like the production renderer", () => {
    const fixture: ComponentFixture = {
      instanceId: "unstyled-card",
      adapterId: "card",
      props: { className: null },
      slots: { header: [], body: [], footer: [] },
    };

    const { container } = render(<>{renderTargetFixture(target, fixture)}</>);

    expect(container.querySelector("article")).not.toHaveClass("rounded-3xl", "bg-zinc-950");
  });

  it("confines the app layout to its declared Sidebar and Main containers", () => {
    const layout = target.adapters.find((adapter) => adapter.component.id === "app-layout");
    expect(layout?.component.slots).toEqual([
      expect.objectContaining({ id: "sidebar", min: 1, max: 1, accepts: ["sidebar"], acceptsText: false }),
      expect.objectContaining({ id: "main", min: 1, max: 1, accepts: ["main"], acceptsText: false }),
    ]);

    const invalid: DesignDocument = {
      schemaVersion: 2,
      id: "screen.invalid-layout",
      label: "Invalid layout",
      kind: "screen",
      root: {
        instanceId: "layout.one",
        adapterId: "app-layout",
        slots: {
          sidebar: [{ kind: "component", node: { instanceId: "button.one", adapterId: "button", slots: {} } }],
          main: [{ kind: "component", node: { instanceId: "main.one", adapterId: "main", slots: { content: [] } } }],
        },
      },
    };

    expect(validateStrictUi(target, invalid)).toContainEqual(expect.objectContaining({
      ruleId: "slot.child",
      location: { kind: "slot", instanceId: "layout.one", slotId: "sidebar" },
    }));
  });

  it("keeps the authored Panel contract compatible with its Stack implementation", () => {
    expect(validateStrictUi(target, panelDocumentJson as DesignDocument)).toEqual([]);
  });
});
