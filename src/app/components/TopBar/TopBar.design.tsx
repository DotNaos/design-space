import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../../shared/component-design";
import { TopBar as ComponentUnderDesign } from "./TopBar";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    targetLabel: "",
    canUndo: false,
    canSave: false,
    canDiff: false,
    runtimeLabel: "",
    connected: false,
    saveLabel: "",
    onUndo: () => undefined,
    onReset: () => undefined,
    onDiff: () => undefined,
    onSave: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
