import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { SourceHoverIdentityHud as ComponentUnderDesign } from "./SourceHoverIdentityHud";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    external: false,
    owner: undefined as never,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
