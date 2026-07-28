import type { ComponentProps } from "react";
import target from "virtual:design-space-target";

import { defineComponentDesign } from "../../shared/component-design";
import { SourceComponentInspector as ComponentUnderDesign } from "./SourceComponentInspector";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    entry: target.sourceWorkspace?.entries.find((entry) => entry.relativePath === "src/app/source/SourceComponentInspector.tsx" && entry.exportName === "SourceComponentInspector"),
  } as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
