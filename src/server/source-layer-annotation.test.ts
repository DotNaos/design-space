import { expect, it } from "vitest";

import { annotateSourceHtmlLayers, sourceWorkspaceLayerId } from "./source-layer-annotation";

it("adds stable runtime IDs to intrinsic JSX without changing component props", () => {
  const source = `
    export function Panel() {
      return <section><Header /><div><span /></div></section>;
    }
  `;
  const annotated = annotateSourceHtmlLayers(source, "src/components/Panel.tsx");

  expect(annotated).toContain(`<section data-design-space-source-layer-id="${sourceWorkspaceLayerId("src/components/Panel.tsx", source.indexOf("<section"))}">`);
  expect(annotated).toContain("<Header />");
  expect(annotated).not.toContain("<Header data-design-space-source-layer-id");
  expect(annotated.match(/data-design-space-source-layer-id/g)).toHaveLength(3);
});
