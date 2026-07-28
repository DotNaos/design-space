import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { ComponentCatalogBrowser as ComponentUnderDesign } from "./ComponentCatalogBrowser";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    entries: [],
    onSelect: () => undefined,
  } as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
