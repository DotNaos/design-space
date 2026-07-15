import { describe, expect, it } from "vitest";

import { indexPreviewDom } from "./dom-snapshot";

describe("live preview DOM indexing", () => {
  it("captures normal HTML and stops at nested component boundaries", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <article data-design-space-instance-id="card.one" data-design-space-html-id="html:card.one:card.article">
        <div><button>Action</button></div>
        <header data-design-space-slot-id="slot:card.one:header"></header>
        <section data-design-space-instance-id="copy.one"><strong>Nested</strong></section>
        <span data-design-space-outlet-id="body.outlet"></span>
      </article>`;

    const snapshot = indexPreviewDom(root);

    expect(snapshot["card.one"]).toMatchObject([{
      id: "card.article",
      tagName: "article",
      children: [
        { id: "dom.0.0", tagName: "div", children: [{ id: "dom.0.0.0", tagName: "button" }] },
        { id: "dom.0.1", tagName: "header", slotId: "header" },
      ],
    }]);
    expect(snapshot["copy.one"]).toMatchObject([{
      id: "dom.0",
      tagName: "section",
      children: [{ id: "dom.0.0", tagName: "strong" }],
    }]);
    expect(root.querySelector("button")).toHaveAttribute("data-design-space-html-id", "html:card.one:dom.0.0.0");
  });

  it("omits the synthetic display-contents wrapper around fragment adapters", () => {
    const root = document.createElement("div");
    root.innerHTML = '<span data-design-space-instance-id="fragment.one" style="display: contents"><strong>First</strong><em>Second</em></span>';
    expect(indexPreviewDom(root)["fragment.one"]).toMatchObject([
      { tagName: "strong" },
      { tagName: "em" },
    ]);
  });
});
