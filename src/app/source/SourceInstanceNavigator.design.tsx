import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { SourceInstanceNavigator as ComponentUnderDesign } from "./SourceInstanceNavigator";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    count: 0,
    index: 0,
    onChange: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
