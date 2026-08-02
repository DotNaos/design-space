import type { ComponentProps } from "react";
import target from "virtual:design-space-target";

import { defineComponentDesign } from "../../shared/component-design";
import { SourcePreviewContent as ComponentUnderDesign } from "./source-static-preview";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    caseName: "",
    definition: undefined as never,
    entry: target.sourceWorkspace?.entries.find((entry) => entry.relativePath === "src/app/source/source-static-preview.tsx" && entry.exportName === "SourcePreviewContent"),
    matrix: false,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
