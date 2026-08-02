import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { SourceCanvasContextHud as ComponentUnderDesign } from "./SourceCanvasContextHud";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    contextLabel: "",
    mode: "preview",
    playing: false,
    onPlayChange: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
