import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../../shared/component-design";
import { ComponentTree as ComponentUnderDesign } from "./ComponentTree";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    pageLabel: "",
    rows: [],
    selectedId: "",
    showInternals: false,
    onSelect: () => undefined,
    onToggleInternals: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
