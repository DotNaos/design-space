import ts from "typescript";

const sourceLayerAttribute = "data-design-space-source-layer-id";

export function sourceWorkspaceLayerId(relativePath: string, start: number, suffix?: string): string {
  return `jsx:${relativePath}:${start}${suffix ? `:${suffix}` : ""}`;
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
      addIntrinsicAnnotation(node, node.openingElement, relativePath, insertions);
    } else if (ts.isJsxSelfClosingElement(node)) {
      addIntrinsicAnnotation(node, node, relativePath, insertions);
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

function addIntrinsicAnnotation(
  layer: ts.JsxElement | ts.JsxSelfClosingElement,
  opening: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  relativePath: string,
  insertions: Array<{ offset: number; value: string }>,
): void {
  const label = opening.tagName.getText();
  if (!isIntrinsicTag(label) || opening.attributes.properties.some((property) => (
    ts.isJsxAttribute(property) && property.name.getText() === sourceLayerAttribute
  ))) return;
  const id = sourceWorkspaceLayerId(relativePath, layer.getStart());
  insertions.push({
    offset: opening.tagName.end,
    value: ` ${sourceLayerAttribute}=${JSON.stringify(id)}`,
  });
}

function isIntrinsicTag(label: string): boolean {
  return /^[a-z]/.test(label) || label.includes("-");
}
