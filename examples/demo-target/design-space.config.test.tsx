import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { createTargetViewModel, renderTargetFixture } from "../../src/app/target-model";
import type { ComponentFixture } from "../../src/shared/target-module";
import { target } from "./design-space.config";

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
});
