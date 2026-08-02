import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { DesktopDocumentEditingPanel as ComponentUnderDesign } from "./DesktopDocumentEditingPanel";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    definitionEditor: false,
    document: undefined as never,
    documents: [],
    catalogComponents: [],
    files: [],
    selectedNodeId: "",
    itemEditor: () => undefined,
    onDocumentChange: () => undefined,
    onDefinitionEditorChange: () => undefined,
    onOpenIsolated: () => undefined,
    onSelectSlot: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
