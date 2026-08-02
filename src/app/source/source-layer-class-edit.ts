import type {
  SourceLayerClassNameBinding,
  SourceLayerTextBinding,
} from "../../shared/source-workspace";

export function sourceWithLayerVisualState(
  source: string,
  values: {
    className?: { binding: SourceLayerClassNameBinding; value: string };
    text?: { binding: SourceLayerTextBinding; value: string };
  },
): string {
  const edits = [
    values.className ? {
      start: values.className.binding.start,
      apply: (current: string) => sourceWithLayerClassName(current, values.className!.binding, values.className!.value),
    } : undefined,
    values.text ? {
      start: values.text.binding.start,
      apply: (current: string) => sourceWithLayerText(current, values.text!.binding, values.text!.value),
    } : undefined,
  ].filter((edit): edit is { start: number; apply: (current: string) => string } => Boolean(edit));
  return edits.sort((left, right) => right.start - left.start).reduce((current, edit) => edit.apply(current), source);
}

export function sourceWithLayerClassName(
  source: string,
  binding: SourceLayerClassNameBinding,
  value: string,
): string {
  if (binding.start < 0 || binding.end < binding.start || binding.end > source.length) return source;
  if (binding.insert && !value) return source;
  if (binding.insert
    ? !isJsxAttributeInsertionPoint(source, binding.start)
    : !isCurrentClassNameBinding(source.slice(binding.start, binding.end), binding)) {
    return source;
  }
  const attribute = binding.syntax === "attribute"
    ? `className="${escapeJsxAttribute(value)}"`
    : `className={${JSON.stringify(value)}}`;
  const replacement = `${binding.insert ? " " : ""}${attribute}`;
  return `${source.slice(0, binding.start)}${replacement}${source.slice(binding.end)}`;
}

function isCurrentClassNameBinding(current: string, binding: SourceLayerClassNameBinding): boolean {
  if (binding.syntax === "expression") {
    return current === `className={${JSON.stringify(binding.value)}}`;
  }
  return current === `className="${escapeJsxAttribute(binding.value)}"`;
}

function isJsxAttributeInsertionPoint(source: string, offset: number): boolean {
  const before = source.slice(0, offset);
  const after = source.slice(offset);
  return /<[A-Za-z][\w.:$-]*$/.test(before) && /^(?:\s|\/?>)/.test(after);
}

function escapeJsxAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
}

export function sourceWithLayerText(
  source: string,
  binding: SourceLayerTextBinding,
  value: string,
): string {
  if (binding.start < 0 || binding.end < binding.start || binding.end > source.length) return source;
  const current = source.slice(binding.start, binding.end);
  if (binding.syntax === "text" ? decodeJsxText(current) !== binding.value : !isStaticJsxExpression(current)) {
    return source;
  }
  const replacement = binding.syntax === "expression"
    ? `{${JSON.stringify(value)}}`
    : escapeJsxText(value);
  return `${source.slice(0, binding.start)}${replacement}${source.slice(binding.end)}`;
}

function isStaticJsxExpression(value: string): boolean {
  const expression = value.trim();
  if (!expression.startsWith("{") || !expression.endsWith("}")) return false;
  const literal = expression.slice(1, -1).trim();
  return literal.length >= 2
    && ["\"", "'", "`"].includes(literal[0] ?? "")
    && literal.at(-1) === literal[0];
}

function decodeJsxText(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&#123;", "{")
    .replaceAll("&#125;", "}")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&");
}

function escapeJsxText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("{", "&#123;")
    .replaceAll("}", "&#125;");
}
