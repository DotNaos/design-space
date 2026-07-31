import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../../shared/component-design";
import { SelfHostingBadge as ComponentUnderDesign } from "./index";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  preview: {
    background: "#0f1115",
    minHeight: 280,
    padding: 32,
    width: "min(100%, 520px)",
    layout: "center",
  },
  defaults: {
    label: "Design Space",
  } satisfies ComponentProps<typeof ComponentUnderDesign>,
  designs: {
    default: {},
    review: {
      label: "Ready for review",
    },
  },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
