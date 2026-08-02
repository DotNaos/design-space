import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../../shared/component-design";
import { CatalogPanel as ComponentUnderDesign } from "./CatalogPanel";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    entries: [],
    onSelect: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
