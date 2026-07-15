import type { DesignDocument } from "../../shared/design-document";
import { findDesignNode } from "./document-commands";

export function focusDocumentOnComponent(
  document: DesignDocument,
  instanceId: string | undefined,
): DesignDocument {
  if (!instanceId) return document;
  const root = findDesignNode(document.root, instanceId);
  return root ? { ...document, root } : document;
}
