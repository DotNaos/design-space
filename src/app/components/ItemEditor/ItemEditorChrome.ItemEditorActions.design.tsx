import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../../shared/component-design";
import { ItemEditorActions as ComponentUnderDesign } from "./ItemEditorChrome";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    canMoveUp: false,
    canMoveDown: false,
    canDuplicate: false,
    canDelete: false,
    onMove: () => undefined,
    onDuplicate: () => undefined,
    onDelete: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
