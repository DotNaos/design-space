import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { DocumentNavigator as ComponentUnderDesign } from "./DocumentNavigator";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    mode: "app",
    entries: [],
    canCreate: false,
    onModeChange: () => undefined,
    onSelect: () => undefined,
    onCreate: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
