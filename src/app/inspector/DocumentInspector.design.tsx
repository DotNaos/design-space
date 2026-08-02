import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { DocumentInspector as ComponentUnderDesign } from "./DocumentInspector";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    componentLabel: "",
    controls: [],
    values: undefined as never,
    compilePending: false,
    canMoveUp: false,
    canMoveDown: false,
    canDuplicate: false,
    canDelete: false,
    onControlChange: () => undefined,
    onSelectSlot: () => undefined,
    onMove: () => undefined,
    onDuplicate: () => undefined,
    onDelete: () => undefined,
    onApply: () => undefined,
    onCancel: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
