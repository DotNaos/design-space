import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import type { SourceWorkspaceLayer } from "../../shared/source-workspace";
import { SourceLayerDesignInspector as ComponentUnderDesign } from "./SourceLayerDesignInspector";

const designLayer: SourceWorkspaceLayer = {
  id: "source-layer-design-preview",
  label: "section",
  kind: "html",
  source: { start: 0, end: 0 },
  className: {
    start: 0,
    end: 0,
    syntax: "attribute",
    value:
      "flex min-h-10 items-center gap-2 border-b border-white/[0.06] px-4",
  },
  children: [],
};

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    layer: designLayer,
    metrics: {
      x: 24,
      y: 24,
      width: 320,
      height: 44,
    },
  } satisfies ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
