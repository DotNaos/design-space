export function monacoModelPath(path: string, modelId: string): string {
  const normalized = `/${path.replace(/^\/+/, "")}`;
  const unique = modelId.replace(/[^a-z0-9_-]/gi, "") || "model";
  const extension = /\.[^/.]+$/.exec(normalized);
  if (!extension) return `${normalized}.design-space-${unique}`;
  return `${normalized.slice(0, extension.index)}.design-space-${unique}${extension[0]}`;
}
