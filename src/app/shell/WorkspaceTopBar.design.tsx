import type { ComponentProps } from "react";

import { defineComponentDesign } from "../../shared/component-design";
import { WorkspaceTopBar as ComponentUnderDesign } from "./WorkspaceTopBar";

export default defineComponentDesign(ComponentUnderDesign, {
  isStateful: false,
  defaults: {
    targetLabel: "",
    documentLabel: "",
    connected: false,
    checking: false,
    canUndo: false,
    canRedo: false,
    canReset: false,
    canStrictUi: false,
    canDiff: false,
    canSave: false,
    saving: false,
    onUndo: () => undefined,
    onRedo: () => undefined,
    onReset: () => undefined,
    onStrictUi: () => undefined,
    onDiff: () => undefined,
    onSave: () => undefined,
  } as unknown as ComponentProps<typeof ComponentUnderDesign>,
  designs: { default: {} },
  render: (props: ComponentProps<typeof ComponentUnderDesign>) => <ComponentUnderDesign {...props} />,
});
