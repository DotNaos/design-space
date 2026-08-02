import type { ComponentProps } from "react";
import target from "virtual:design-space-target";

import { defineComponentDesign } from "../../shared/component-design";
import { SourceLibraryInspector as ComponentUnderDesign } from "./SourceLibraryWorkspace";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    device: "desktop",
    mode: "development",
    onDeviceChange: () => undefined,
    onModeChange: () => undefined,
    onGenerateDesign: target.sourceWorkspace?.entries.find((entry) => entry.relativePath === "src/app/source/SourceLibraryWorkspace.tsx" && entry.exportName === "SourceLibraryInspector"),
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
