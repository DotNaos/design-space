import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { WorkspaceBrowser as ComponentUnderDesign } from "./WorkspaceBrowser";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    view: "files",
    mode: "app",
    entries: [],
    files: [],
    catalogEntries: [],
    canCreate: false,
    onViewChange: () => undefined,
    onModeChange: () => undefined,
    onDocumentSelect: () => undefined,
    onCatalogSelect: () => undefined,
    onCreate: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
