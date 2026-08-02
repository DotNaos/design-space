import type { ComponentProps } from "react";
import target from "virtual:design-space-target";

import { defineComponentDesign } from "../../shared/component-design";
import { SourcePreviewFrame as ComponentUnderDesign } from "./SourcePreviewFrame";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    device: "desktop",
    entry: target.sourceWorkspace?.entries.find((entry) => entry.relativePath === "src/app/source/SourcePreviewFrame.tsx" && entry.exportName === "SourcePreviewFrame"),
    runtime: "react",
    styles: [],
    entries: target.sourceWorkspace?.entries.find((entry) => entry.relativePath === "src/app/source/SourcePreviewFrame.tsx" && entry.exportName === "SourcePreviewFrame"),
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
