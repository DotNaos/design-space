import { expect, it } from "vitest";

import { annotateSourceHtmlLayers } from "./source-layer-annotation";

it("adds stable runtime IDs to intrinsic and component JSX while leaving fragments untouched", () => {
  const source = `
    export function Panel() {
      return <><section><Header /><div><span /></div></section></>;
    }
  `;
  const annotated = annotateSourceHtmlLayers(source, "src/components/Panel.tsx");

  expect(annotated).toContain('<section data-design-space-source-layer-id="jsx:src/components/Panel.tsx:layer-0">');
  expect(annotated).toContain('<Header data-design-space-source-layer-id="jsx:src/components/Panel.tsx:layer-1" />');
  expect(annotated).not.toContain("< data-design-space-source-layer-id");
  expect(annotated.match(/data-design-space-source-layer-id/g)).toHaveLength(4);
});
