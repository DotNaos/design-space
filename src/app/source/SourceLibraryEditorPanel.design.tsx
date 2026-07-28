import type { ComponentProps } from "react";
import target from "virtual:design-space-target";

import { defineComponentDesign } from "../../shared/component-design";
import { SourceLibraryEditorPanel as ComponentUnderDesign } from "./SourceLibraryEditorPanel";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    activeTab: "code",
    codeDocument: "source",
    designEditor: undefined as never,
    entry: target.sourceWorkspace?.entries.find((entry) => entry.relativePath === "src/app/source/SourceLibraryEditorPanel.tsx" && entry.exportName === "SourceLibraryEditorPanel"),
    mode: "development",
    sourceEditor: undefined as never,
    onActiveTabChange: () => undefined,
    onCodeDocumentChange: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
