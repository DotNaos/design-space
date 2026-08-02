import ts from "typescript";

const sourceLayerAttribute = "data-design-space-source-layer-id";

export function sourceWorkspaceLayerId(relativePath: string, start: number, suffix?: string): string {
  return `jsx:${relativePath}:${start}${suffix ? `:${suffix}` : ""}`;
}

/**
 * JSX layer IDs must survive source-only edits before a layer. Source offsets
 * are still the source-range truth, but the runtime marker uses the layer's
 * structural JSX ordinal so the rendered component and a draft analysis keep
 * speaking about the same element.
 */
export function sourceWorkspaceJsxLayerId(relativePath: string, node: ts.Node): string {
  const sourceFile = node.getSourceFile();
  let ordinal = 0;
  let resolved: number | undefined;
  const visit = (candidate: ts.Node): void => {
    if (resolved !== undefined) return;
    if (isSourceLayerNode(candidate)) {
      if (candidate === node) {
        resolved = ordinal;
        return;
      }
      ordinal += 1;
    }
    ts.forEachChild(candidate, visit);
  };
  visit(sourceFile);
  return `jsx:${relativePath}:layer-${resolved ?? node.getStart()}`;
}

export function annotateSourceHtmlLayers(source: string, relativePath: string): string {
  const sourceFile = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const insertions: Array<{ offset: number; value: string }> = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxElement(node)) {
      addSourceAnnotation(node, node.openingElement, relativePath, insertions);
    } else if (ts.isJsxSelfClosingElement(node)) {
      addSourceAnnotation(node, node, relativePath, insertions);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return insertions
    .sort((left, right) => right.offset - left.offset)
    .reduce((result, insertion) => (
      `${result.slice(0, insertion.offset)}${insertion.value}${result.slice(insertion.offset)}`
    ), source);
}

function addSourceAnnotation(
  layer: ts.JsxElement | ts.JsxSelfClosingElement,
  opening: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  relativePath: string,
  insertions: Array<{ offset: number; value: string }>,
): void {
  const label = opening.tagName.getText();
  if (isFragmentTag(label) || opening.attributes.properties.some((property) => (
    ts.isJsxAttribute(property) && property.name.getText() === sourceLayerAttribute
  ))) return;
  const id = sourceWorkspaceJsxLayerId(relativePath, layer);
  insertions.push({
    offset: opening.tagName.end,
    value: ` ${sourceLayerAttribute}=${JSON.stringify(id)}`,
  });
}

function isFragmentTag(label: string): boolean {
  return label === "Fragment" || label === "React.Fragment";
}

function isSourceLayerNode(node: ts.Node): node is ts.JsxElement | ts.JsxSelfClosingElement {
  if (ts.isJsxElement(node)) return !isFragmentTag(node.openingElement.tagName.getText());
  return ts.isJsxSelfClosingElement(node) && !isFragmentTag(node.tagName.getText());
}
