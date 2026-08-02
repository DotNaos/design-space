import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../../shared/component-design";
import { MobileItemEditor as ComponentUnderDesign } from "./MobileItemEditor";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    componentLabel: "",
    controls: [],
    controlValues: undefined as never,
    previewCss: "",
    compilePending: false,
    sourceBacked: false,
    canMoveUp: false,
    canMoveDown: false,
    canDuplicate: false,
    canDelete: false,
    onControlChange: () => undefined,
    onMove: () => undefined,
    onDuplicate: () => undefined,
    onDelete: () => undefined,
    onCancel: () => undefined,
    onApply: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
