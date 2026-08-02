import ts from "typescript";

import type { SourceLayerClassNameBinding, SourceWorkspaceLayer } from "../shared/source-workspace";

export function jsxClassName(
  opening: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  kind: SourceWorkspaceLayer["kind"],
  checker: ts.TypeChecker,
): Pick<SourceWorkspaceLayer, "className" | "classNameDynamic"> {
  const attribute = opening.attributes.properties.find((property): property is ts.JsxAttribute => (
    ts.isJsxAttribute(property) && property.name.getText() === "className"
  ));
  if (!attribute) {
    if (kind === "component" && !jsxComponentAcceptsClassName(opening, checker)) return {};
    return {
      className: {
        value: "",
        start: opening.tagName.end,
        end: opening.tagName.end,
        insert: true,
      },
    };
  }
  const staticValue = staticJsxAttributeValue(attribute.initializer);
  if (!staticValue) return { classNameDynamic: true };
  return {
    className: {
      value: staticValue.value,
      start: attribute.getStart(),
      end: attribute.getEnd(),
      syntax: staticValue.syntax,
    },
  };
}

function jsxComponentAcceptsClassName(
  opening: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  checker: ts.TypeChecker,
): boolean {
  const componentType = checker.getTypeAtLocation(opening.tagName);
  return componentType.getCallSignatures().some((signature) => {
    const parameter = signature.getParameters()[0];
    return parameter
      ? Boolean(checker.getTypeOfSymbolAtLocation(parameter, opening).getProperty("className"))
      : false;
  });
}

function staticJsxAttributeValue(
  initializer: ts.JsxAttributeValue | undefined,
): Pick<SourceLayerClassNameBinding, "value" | "syntax"> | undefined {
  if (!initializer) return undefined;
  if (ts.isStringLiteral(initializer)) return { value: initializer.text, syntax: "attribute" };
  if (!ts.isJsxExpression(initializer) || !initializer.expression) return undefined;
  if (ts.isStringLiteral(initializer.expression) || ts.isNoSubstitutionTemplateLiteral(initializer.expression)) {
    return { value: initializer.expression.text, syntax: "expression" };
  }
  return undefined;
}
