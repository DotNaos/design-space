import type { ComponentProps } from "react";
import target from "virtual:design-space-target";

import { defineComponentDesign } from "../../shared/component-design";
import { SourceAppCanvas as ComponentUnderDesign } from "./SourceAppCanvas";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    centerContent: false,
    device: "desktop",
    editor: undefined as never,
    entry: target.sourceWorkspace?.entries.find((entry) => entry.relativePath === "src/app/source/SourceAppCanvas.tsx" && entry.exportName === "SourceAppCanvas"),
    entries: target.sourceWorkspace?.entries.find((entry) => entry.relativePath === "src/app/source/SourceAppCanvas.tsx" && entry.exportName === "SourceAppCanvas"),
    generatingDesign: false,
    mode: "design",
    nestedPreview: false,
    previewEntry: target.sourceWorkspace?.entries.find((entry) => entry.relativePath === "src/app/source/SourceAppCanvas.tsx" && entry.exportName === "SourceAppCanvas"),
    runtime: "react",
    slotLayers: [],
    styles: [],
    workspaceMode: "preview",
    onDeviceChange: () => undefined,
    onModeChange: () => undefined,
    onOpenLayerOwner: () => undefined,
    onReturnToPreview: () => undefined,
    onSelectLayer: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
