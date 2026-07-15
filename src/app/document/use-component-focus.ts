import { useMemo, useState } from "react";

import type { DesignDocument } from "../../shared/design-document";
import type { TargetModule } from "../../shared/target-module";
import { focusDocumentOnComponent } from "./component-focus";
import { resolveDocumentAdapter } from "./document-adapters";
import { findDesignNode } from "./document-commands";

export function useComponentFocus(
  document: DesignDocument,
  target: TargetModule,
  library: readonly DesignDocument[],
) {
  const [instanceId, setInstanceId] = useState<string>();
  const focusedDocument = useMemo(
    () => focusDocumentOnComponent(document, instanceId),
    [document, instanceId],
  );
  const node = instanceId ? findDesignNode(document.root, instanceId) : undefined;
  const label = node
    ? resolveDocumentAdapter(target, library, node.adapterId)?.component.label ?? node.label ?? "Component"
    : undefined;

  return {
    instanceId,
    document: focusedDocument,
    label,
    open: setInstanceId,
    close: () => setInstanceId(undefined),
  };
}
