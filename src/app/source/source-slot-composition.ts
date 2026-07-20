import type {
  DesignSpaceDevice,
  RuntimeSourceWorkspace,
  RuntimeSourceWorkspaceEntry,
  SourceLayerBinding,
  SourceWorkspaceLayer,
} from "../../shared/source-workspace";
import type { SourceTreeNode } from "./source-workspace-tree";

export interface SourceComponentCandidate {
  id: string;
  name: string;
  group: string;
  source: string;
  importSource?: string;
  exportName?: string;
  entry?: RuntimeSourceWorkspaceEntry;
  compatible: boolean;
  insertable: boolean;
  explanation?: string;
  deviceState: "available" | "fallback" | "missing";
}

export function sourceSlotCandidates(
  workspace: RuntimeSourceWorkspace,
  nodes: readonly SourceTreeNode[],
  slot: SourceWorkspaceLayer,
  device: DesignSpaceDevice,
  ownerPath: string,
): readonly SourceComponentCandidate[] {
  const accepted = new Set(slot.slot?.contract.accepts.map(shortName) ?? []);
  const project = nodes.flatMap((node): SourceComponentCandidate[] => {
    const implementation = node.implementations[device];
    const entry = implementation.entry ?? node.entries[0];
    if (!entry) return [];
    const compatible = accepted.has(shortName(entry.exportName)) || accepted.has(shortName(entry.label));
    const required = [
      ...entry.props.filter((property) => property.required).map((property) => property.name),
      ...entry.slots.filter((candidate) => candidate.min > 0).map((candidate) => `slots.${candidate.name}`),
    ];
    const importSource = entry.relativePath === ownerPath ? undefined : relativeImport(ownerPath, entry.relativePath);
    return [{
      id: entry.id,
      name: entry.label,
      group: entry.area === "components" ? "Project components" : entry.area === "pages" ? "Pages" : "App",
      source: entry.relativePath,
      importSource,
      exportName: entry.exportName,
      entry,
      compatible,
      insertable: compatible && required.length === 0,
      ...(compatible && required.length
        ? { explanation: `Requires values for ${required.join(", ")}; Design Space will not invent them.` }
        : !compatible
          ? { explanation: `Expected ${[...accepted].join(" or ")}.` }
          : {}),
      deviceState: implementation.state === "missing" ? "missing" : implementation.state === "fallback" ? "fallback" : "available",
    }];
  });
  const library = (workspace.library?.components ?? []).map((component): SourceComponentCandidate => {
    const compatible = accepted.has(shortName(component.name));
    return {
      id: `library:${component.name}`,
      name: component.name,
      group: workspace.library?.packageName ?? "Component library",
      source: workspace.library?.packageName ?? "Component library",
      importSource: workspace.library?.packageName,
      exportName: component.name,
      compatible,
      insertable: compatible,
      ...(!compatible ? { explanation: `Expected ${[...accepted].join(" or ")}.` } : {}),
      deviceState: "available",
    };
  });
  return [...project, ...library]
    .filter((candidate, index, all) => all.findIndex((item) => item.name === candidate.name) === index)
    .sort((left, right) => Number(right.compatible) - Number(left.compatible) || left.group.localeCompare(right.group) || left.name.localeCompare(right.name));
}

export function filterSourceSlotCandidates(
  candidates: readonly SourceComponentCandidate[],
  query: string,
  revealIncompatible: boolean,
): readonly SourceComponentCandidate[] {
  const normalized = query.trim().toLocaleLowerCase();
  return candidates.filter((candidate) => (
    (revealIncompatible || candidate.compatible)
    && (!normalized || `${candidate.name} ${candidate.group} ${candidate.source}`.toLocaleLowerCase().includes(normalized))
  ));
}

export function applySourceSlotCandidate(
  source: string,
  ownerPath: string,
  slot: SourceWorkspaceLayer,
  candidate: SourceComponentCandidate,
  action: "add" | "replace",
): { source: string; selection: SourceLayerBinding } {
  const usage = slot.slot;
  if (!usage || !candidate.compatible || !candidate.insertable) {
    throw new Error(candidate.explanation ?? "This component cannot be inserted into the selected slot.");
  }
  if (action === "add" && usage.contract.max !== undefined && usage.received.length >= usage.contract.max) {
    throw new Error(`The ${slot.label} slot is full (${usage.received.length}/${usage.contract.max}).`);
  }
  const jsx = `<${candidate.name} />`;
  let next = source;
  let start = usage.edit.insertAt;
  const value = usage.edit.value;
  if (usage.edit.kind === "missing-attribute") {
    const insertion = ` slots={{ ${slot.label}: ${usage.contract.multiple ? `[${jsx}]` : jsx} }}`;
    next = replaceRange(next, usage.edit.insertAt, usage.edit.insertAt, insertion);
    start = usage.edit.insertAt + insertion.indexOf(jsx);
  } else if (usage.edit.kind === "missing-property") {
    const prefix = missingPropertyPrefix(source, usage.edit.insertAt);
    const insertion = `${prefix}${slot.label}: ${usage.contract.multiple ? `[${jsx}]` : jsx}`;
    next = replaceRange(next, usage.edit.insertAt, usage.edit.insertAt, insertion);
    start = usage.edit.insertAt + insertion.indexOf(jsx);
  } else if (action === "replace" || usage.edit.kind === "single") {
    if (!value) throw new Error("The selected slot has no editable source range.");
    const replacement = usage.contract.multiple ? `[${jsx}]` : jsx;
    next = replaceRange(next, value.start, value.end, replacement);
    start = value.start + replacement.indexOf(jsx);
  } else if (usage.edit.list) {
    const prefix = usage.received.length ? ", " : "";
    const insertion = `${prefix}${jsx}`;
    next = replaceRange(next, usage.edit.list.end, usage.edit.list.end, insertion);
    start = usage.edit.list.end + prefix.length;
  } else if (value) {
    const previous = source.slice(value.start, value.end);
    const replacement = `[${previous}, ${jsx}]`;
    next = replaceRange(next, value.start, value.end, replacement);
    start = value.start + replacement.lastIndexOf(jsx);
  } else {
    throw new Error("The selected slot has no editable source range.");
  }

  if (candidate.importSource && candidate.source !== ownerPath && !hasImport(source, candidate.name)) {
    const statement = candidate.exportName === "default"
      ? `import ${candidate.name} from ${JSON.stringify(candidate.importSource)};\n`
      : `import { ${candidate.exportName ?? candidate.name} } from ${JSON.stringify(candidate.importSource)};\n`;
    const importAt = importInsertionOffset(next);
    next = replaceRange(next, importAt, importAt, statement);
    if (importAt <= start) start += statement.length;
  }
  return { source: next, selection: { start, end: start + jsx.length } };
}

export function removeSourceSlotChild(
  source: string,
  slot: SourceWorkspaceLayer,
  index: number,
): { source: string; selection: SourceLayerBinding } {
  const usage = slot.slot;
  const child = slot.children[index];
  if (!usage || !child) throw new Error("The selected slot item no longer exists.");
  if (usage.received.length - 1 < usage.contract.min) {
    throw new Error(`The ${slot.label} slot requires at least ${usage.contract.min} item${usage.contract.min === 1 ? "" : "s"}.`);
  }
  if (!usage.contract.multiple) {
    const property = usage.edit.property;
    if (!property) throw new Error("The selected slot property cannot be removed safely.");
    const range = commaAwarePropertyRange(source, property);
    return { source: replaceRange(source, range.start, range.end, ""), selection: { start: range.start, end: range.start } };
  }
  const range = commaAwareListItemRange(source, child.source, usage.edit.list);
  return { source: replaceRange(source, range.start, range.end, ""), selection: { start: range.start, end: range.start } };
}

export function moveSourceSlotChild(
  source: string,
  slot: SourceWorkspaceLayer,
  index: number,
  direction: -1 | 1,
): { source: string; selection: SourceLayerBinding } {
  const usage = slot.slot;
  const target = index + direction;
  if (!usage?.contract.multiple || !usage.edit.list || !slot.children[index] || !slot.children[target]) {
    throw new Error("This slot item cannot move in that direction.");
  }
  const snippets = slot.children.map((child) => source.slice(child.source.start, child.source.end));
  [snippets[index], snippets[target]] = [snippets[target]!, snippets[index]!];
  const replacement = snippets.join(", ");
  const next = replaceRange(source, usage.edit.list.start, usage.edit.list.end, replacement);
  const before = snippets.slice(0, target).reduce((length, value) => length + value.length + 2, 0);
  return {
    source: next,
    selection: {
      start: usage.edit.list.start + before,
      end: usage.edit.list.start + before + snippets[target]!.length,
    },
  };
}

function replaceRange(source: string, start: number, end: number, value: string): string {
  return `${source.slice(0, start)}${value}${source.slice(end)}`;
}

function commaAwarePropertyRange(source: string, property: SourceLayerBinding): SourceLayerBinding {
  const after = source.slice(property.end).match(/^\s*,\s*/)?.[0];
  if (after) return { start: property.start, end: property.end + after.length };
  const before = source.slice(0, property.start).match(/,\s*$/)?.[0];
  return before ? { start: property.start - before.length, end: property.end } : property;
}

function commaAwareListItemRange(
  source: string,
  child: SourceLayerBinding,
  list: SourceLayerBinding | undefined,
): SourceLayerBinding {
  const end = list?.end ?? source.length;
  const after = source.slice(child.end, end).match(/^\s*,\s*/)?.[0];
  if (after) return { start: child.start, end: child.end + after.length };
  const start = list?.start ?? 0;
  const before = source.slice(start, child.start).match(/,\s*$/)?.[0];
  return before ? { start: child.start - before.length, end: child.end } : child;
}

function missingPropertyPrefix(source: string, offset: number): string {
  const previous = source.slice(0, offset).trimEnd().at(-1);
  if (!previous || previous === "{") return "";
  return previous === "," ? " " : ", ";
}

function hasImport(source: string, name: string): boolean {
  return new RegExp(`import\\s+(?:${name}\\s+from|\\{[^}]*\\b${name}\\b[^}]*\\}\\s+from)`).test(source);
}

function importInsertionOffset(source: string): number {
  let end = 0;
  for (const match of source.matchAll(/^import[\s\S]*?;\s*$/gm)) end = (match.index ?? 0) + match[0].length;
  return end;
}

function relativeImport(ownerPath: string, targetPath: string): string {
  const owner = ownerPath.split("/").slice(0, -1);
  const target = targetPath.replace(/\.[cm]?[jt]sx?$/, "").split("/");
  while (owner.length && target.length && owner[0] === target[0]) {
    owner.shift();
    target.shift();
  }
  const value = `${owner.map(() => "..").join("/")}${owner.length && target.length ? "/" : ""}${target.join("/")}`;
  return value.startsWith(".") ? value : `./${value}`;
}

function shortName(value: string): string {
  return value.split(".").at(-1) ?? value;
}
