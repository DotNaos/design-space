import { htmlSelectionId, type HtmlTreeNode } from "../../model";

export type PreviewDomSnapshot = Readonly<Record<string, readonly HtmlTreeNode[]>>;

export function indexPreviewDom(root: HTMLElement): PreviewDomSnapshot {
  const snapshot: Record<string, readonly HtmlTreeNode[]> = {};
  const seen = new Set<string>();
  for (const element of root.querySelectorAll<HTMLElement>("[data-design-space-instance-id]")) {
    const instanceId = element.dataset.designSpaceInstanceId;
    if (!instanceId || seen.has(instanceId)) continue;
    seen.add(instanceId);
    snapshot[instanceId] = observeElement(element, instanceId, [0], true);
  }
  return snapshot;
}

function observeElement(
  element: HTMLElement,
  instanceId: string,
  path: readonly number[],
  root: boolean,
): HtmlTreeNode[] {
  const nestedInstance = element.dataset.designSpaceInstanceId;
  if (!root && nestedInstance && nestedInstance !== instanceId) return [];
  if (element.dataset.designSpaceOutletId !== undefined) return [];
  const children = [...element.children].flatMap((child, index) => (
    child instanceof HTMLElement ? observeElement(child, instanceId, [...path, index], false) : []
  ));
  if (isSyntheticAnchor(element, root)) return children;
  const nodeId = semanticNodeId(element, instanceId) ?? `dom.${path.join(".")}`;
  const selectionId = htmlSelectionId(instanceId, nodeId);
  if (element.dataset.designSpaceHtmlId !== selectionId) element.dataset.designSpaceHtmlId = selectionId;
  const slotId = semanticSlotId(element, instanceId);
  return [{
    kind: "html",
    id: nodeId,
    tagName: element.tagName.toLocaleLowerCase(),
    ...(element.className ? { className: element.className } : {}),
    ...(slotId ? { slotId } : {}),
    ...(children.length ? { children } : {}),
  }];
}

function semanticNodeId(element: HTMLElement, instanceId: string): string | undefined {
  const selectionId = element.dataset.designSpaceHtmlId;
  const prefix = `html:${encodeURIComponent(instanceId)}:`;
  if (!selectionId?.startsWith(prefix)) return undefined;
  try {
    return decodeURIComponent(selectionId.slice(prefix.length));
  } catch {
    return undefined;
  }
}

function semanticSlotId(element: HTMLElement, instanceId: string): string | undefined {
  const selectionId = element.dataset.designSpaceSlotId;
  const prefix = `slot:${encodeURIComponent(instanceId)}:`;
  if (!selectionId?.startsWith(prefix)) return undefined;
  try {
    return decodeURIComponent(selectionId.slice(prefix.length));
  } catch {
    return undefined;
  }
}

function isSyntheticAnchor(element: HTMLElement, root: boolean): boolean {
  if (root) return element.tagName === "SPAN" && element.style.display === "contents";
  return element.tagName === "SPAN"
    && element.style.display === "contents"
    && element.dataset.designSpaceParentSlotId !== undefined;
}
