function lines(value: string): string[] {
  return value.endsWith("\n") ? value.slice(0, -1).split("\n") : value.split("\n");
}

export function createUnifiedDiff(before: string, after: string, label: string): string {
  if (before === after) return "";
  const oldLines = lines(before);
  const newLines = lines(after);
  let prefix = 0;
  while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < oldLines.length - prefix &&
    suffix < newLines.length - prefix &&
    oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const contextStart = Math.max(0, prefix - 3);
  const oldEnd = Math.min(oldLines.length, oldLines.length - suffix + 3);
  const newEnd = Math.min(newLines.length, newLines.length - suffix + 3);
  const output = [`--- a/${label}`, `+++ b/${label}`];
  output.push(
    `@@ -${contextStart + 1},${oldEnd - contextStart} +${contextStart + 1},${newEnd - contextStart} @@`,
  );
  for (let index = contextStart; index < prefix; index += 1) output.push(` ${oldLines[index]}`);
  for (let index = prefix; index < oldLines.length - suffix; index += 1) output.push(`-${oldLines[index]}`);
  for (let index = prefix; index < newLines.length - suffix; index += 1) output.push(`+${newLines[index]}`);
  for (let index = Math.max(prefix, newLines.length - suffix); index < newEnd; index += 1) {
    output.push(` ${newLines[index]}`);
  }
  return `${output.join("\n")}\n`;
}
