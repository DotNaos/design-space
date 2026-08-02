import ts from "typescript";

import type {
  SourceComponentProp,
  SourceComponentSlot,
  SourcePropKind,
  SourceStrictUiFinding,
} from "../shared/source-workspace";

const typeFormatFlags =
  ts.TypeFormatFlags.NoTruncation |
  ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope;

export interface ExtractedComponentContract {
  props: readonly SourceComponentProp[];
  slots: readonly SourceComponentSlot[];
  findings: readonly SourceStrictUiFinding[];
  typeText: string;
}

export function extractComponentContract(
  signature: ts.Signature,
  fallbackDeclaration: ts.Declaration,
  checker: ts.TypeChecker,
): ExtractedComponentContract {
  const parameter = signature.parameters[0];
  if (!parameter) return { props: [], slots: [], findings: [], typeText: "Record<string, never>" };

  const location = parameter.valueDeclaration ?? signature.getDeclaration() ?? fallbackDeclaration;
  const propsType = checker.getTypeOfSymbolAtLocation(parameter, location);
  const props: SourceComponentProp[] = [];
  const slots: SourceComponentSlot[] = [];
  const findings: SourceStrictUiFinding[] = [];

  for (const property of checker.getPropertiesOfType(propsType)) {
    const declaration = property.valueDeclaration ?? property.declarations?.[0] ?? location;
    const type = checker.getTypeOfSymbolAtLocation(property, declaration);
    const name = property.getName();

    if (name === "children") {
      if (!isNeverOrUndefined(type)) {
        findings.push({
          ruleId: "strict-ui.children-forbidden",
          severity: "error",
          message: "Strict UI components must reject children and use explicitly typed named slots.",
        });
      }
      continue;
    }

    if (name === "slots") {
      slots.push(...extractNamedSlots(type, declaration, checker, findings));
      continue;
    }

    props.push({
      kind: primitiveKind(type),
      name,
      required: isRequired(property, type),
      type: checker.typeToString(type, declaration, typeFormatFlags),
      ...finiteValues(type),
    });
  }

  return {
    props,
    slots,
    findings,
    typeText: checker.typeToString(propsType, location, typeFormatFlags),
  };
}

function finiteValues(type: ts.Type): Pick<SourceComponentProp, "values"> {
  const relevant = type.isUnion()
    ? type.types.filter((part) => !(part.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)))
    : [type];
  if (!relevant.length) return {};
  const values = relevant.flatMap((part): (boolean | number | string)[] => {
    if (part.flags & ts.TypeFlags.BooleanLiteral) {
      return [(part as unknown as { intrinsicName?: string }).intrinsicName === "true"];
    }
    if (part.isStringLiteral()) return [part.value];
    if (part.isNumberLiteral()) return [part.value];
    return [];
  });
  if (values.length === relevant.length && values.length <= 24) return { values };
  if (relevant.length === 1 && relevant[0]?.flags & ts.TypeFlags.Boolean) return { values: [false, true] };
  return {};
}

function extractNamedSlots(
  slotsType: ts.Type,
  fallbackDeclaration: ts.Declaration,
  checker: ts.TypeChecker,
  findings: SourceStrictUiFinding[],
): SourceComponentSlot[] {
  const slots: SourceComponentSlot[] = [];
  for (const property of checker.getPropertiesOfType(slotsType)) {
    const declaration = property.valueDeclaration ?? property.declarations?.[0] ?? fallbackDeclaration;
    const type = checker.getTypeOfSymbolAtLocation(property, declaration);
    const node = propertyTypeNode(declaration);
    const contract = node ? slotContractFromNode(node, checker) : undefined;
    if (!contract) {
      findings.push({
        ruleId: "strict-ui.invalid-slot-contract",
        severity: "error",
        message: `Slot ${property.getName()} must use ComponentSlot or ComponentSlotList.`,
      });
      continue;
    }
    if (contract.max !== undefined && contract.max < contract.min) {
      findings.push({
        ruleId: "strict-ui.invalid-slot-contract",
        severity: "error",
        message: `Slot ${property.getName()} has a maximum below its minimum cardinality.`,
      });
      continue;
    }
    const required = isRequired(property, type);
    slots.push({
      name: property.getName(),
      type: checker.typeToString(type, declaration, typeFormatFlags),
      required,
      multiple: contract.multiple,
      accepts: contract.accepts,
      min: contract.multiple ? contract.min : required ? 1 : 0,
      ...(contract.max === undefined ? {} : { max: contract.max }),
    });
  }
  return slots;
}

function slotContractFromNode(
  node: ts.TypeNode,
  checker: ts.TypeChecker,
): { accepts: readonly string[]; multiple: boolean; min: number; max?: number } | undefined {
  if (ts.isParenthesizedTypeNode(node)) return slotContractFromNode(node.type, checker);
  if (ts.isUnionTypeNode(node)) {
    const relevant = node.types.filter((part) => part.kind !== ts.SyntaxKind.UndefinedKeyword);
    return relevant.length === 1 ? slotContractFromNode(relevant[0]!, checker) : undefined;
  }
  if (!ts.isTypeReferenceNode(node)) return undefined;
  const symbol = resolveAliasAtLocation(node.typeName, checker);
  const name = symbol?.getName() ?? node.typeName.getText();
  if (name !== "ComponentSlot" && name !== "ComponentSlotList") return undefined;
  const accepts = acceptedComponentNames(node.typeArguments?.[0]);
  if (!accepts.length) return undefined;
  if (name === "ComponentSlot") return { accepts, multiple: false, min: 1, max: 1 };
  const min = numericTypeArgument(node.typeArguments?.[1]) ?? 0;
  const max = numericTypeArgument(node.typeArguments?.[2]);
  return { accepts, multiple: true, min, ...(max === undefined ? {} : { max }) };
}

function acceptedComponentNames(node: ts.TypeNode | undefined): readonly string[] {
  if (!node) return [];
  if (ts.isParenthesizedTypeNode(node)) return acceptedComponentNames(node.type);
  if (ts.isUnionTypeNode(node)) return [...new Set(node.types.flatMap(acceptedComponentNames))];
  if (ts.isTypeQueryNode(node)) return [node.exprName.getText()];
  if (ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal)) return [node.literal.text];
  return [];
}

function numericTypeArgument(node: ts.TypeNode | undefined): number | undefined {
  if (!node || !ts.isLiteralTypeNode(node) || !ts.isNumericLiteral(node.literal)) return undefined;
  const value = Number(node.literal.text);
  return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function propertyTypeNode(declaration: ts.Declaration): ts.TypeNode | undefined {
  if (
    ts.isPropertySignature(declaration) ||
    ts.isPropertyDeclaration(declaration) ||
    ts.isParameter(declaration)
  ) {
    return declaration.type;
  }
  return undefined;
}

function primitiveKind(type: ts.Type): SourcePropKind {
  const relevant = type.isUnion()
    ? type.types.filter((part) => !(part.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)))
    : [type];
  if (!relevant.length) return "unknown";
  if (relevant.every((part) => Boolean(part.flags & ts.TypeFlags.StringLike))) return "string";
  if (relevant.every((part) => Boolean(part.flags & ts.TypeFlags.NumberLike))) return "number";
  if (relevant.every((part) => Boolean(part.flags & ts.TypeFlags.BooleanLike))) return "boolean";
  return "unknown";
}

function isRequired(property: ts.Symbol, type: ts.Type): boolean {
  return !(property.flags & ts.SymbolFlags.Optional) && !includesUndefined(type, new Set());
}

function includesUndefined(type: ts.Type, seen: Set<ts.Type>): boolean {
  if (seen.has(type)) return false;
  seen.add(type);
  if (type.flags & ts.TypeFlags.Undefined) return true;
  return type.isUnion() && type.types.some((part) => includesUndefined(part, seen));
}

function isNeverOrUndefined(type: ts.Type): boolean {
  const relevant = type.isUnion() ? type.types : [type];
  return relevant.every((part) => Boolean(part.flags & (ts.TypeFlags.Never | ts.TypeFlags.Undefined)));
}

function resolveAliasAtLocation(node: ts.Node, checker: ts.TypeChecker): ts.Symbol | undefined {
  const symbol = checker.getSymbolAtLocation(node);
  if (!symbol) return undefined;
  return symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
}
