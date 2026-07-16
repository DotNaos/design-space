import type { SourceLayerClassNameBinding } from "../../shared/source-workspace";

export function sourceWithLayerClassName(
  source: string,
  binding: SourceLayerClassNameBinding,
  value: string,
): string {
  if (binding.start < 0 || binding.end < binding.start || binding.end > source.length) return source;
  if (binding.insert && !value) return source;
  const attribute = binding.syntax === "attribute"
    ? `className="${escapeJsxAttribute(value)}"`
    : `className={${JSON.stringify(value)}}`;
  const replacement = `${binding.insert ? " " : ""}${attribute}`;
  return `${source.slice(0, binding.start)}${replacement}${source.slice(binding.end)}`;
}

function escapeJsxAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
}
