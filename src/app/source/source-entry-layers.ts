import type { RuntimeSourceWorkspaceEntry, SourceWorkspaceLayer } from "../../shared/source-workspace";

export function sourceEntrySlotLayers(
  entry: RuntimeSourceWorkspaceEntry | undefined,
): readonly SourceWorkspaceLayer[] {
  if (!entry) return [];
  const slots: SourceWorkspaceLayer[] = [];
  const componentLayers: SourceWorkspaceLayer[] = [];
  const visit = (layers: readonly SourceWorkspaceLayer[] | undefined) => {
    for (const layer of layers ?? []) {
      if (layer.kind === "slot") {
        if (!layer.slot) {
          const contract = entry.slots.find((slot) => slot.name === layer.label);
          slots.push(contract ? { ...layer, slotContract: contract } : layer);
        }
        continue;
      }
      if (layer.kind === "component") {
        componentLayers.push(layer);
        continue;
      }
      visit(layer.children);
    }
  };
  visit(entry.layers);
  const implicit = implicitComponentSlots(entry, componentLayers, new Set(slots.map((slot) => slot.label)));
  return slots.length || implicit.length
    ? [...slots, ...implicit]
    : [defaultSlot(entry)];
}

function implicitComponentSlots(
  entry: RuntimeSourceWorkspaceEntry,
  components: readonly SourceWorkspaceLayer[],
  reserved: ReadonlySet<string>,
): readonly SourceWorkspaceLayer[] {
  const grouped = new Map<string, SourceWorkspaceLayer[]>();
  const singleBoundaryKind = new Set(components.map((component) => component.label)).size === 1;
  for (const component of components) {
    const preferred = singleBoundaryKind && reserved.size === 0
      ? "content"
      : lowerCamel(component.label.split(".").at(-1) ?? component.label);
    const label = reserved.has(preferred) ? `${preferred}Component` : preferred;
    grouped.set(label, [...(grouped.get(label) ?? []), component]);
  }
  return [...grouped].map(([label, children]) => ({
    id: `${entry.id}:design-slot:${label}`,
    label,
    kind: "slot" as const,
    source: children[0]?.source ?? entry.source,
    children,
  }));
}

function defaultSlot(entry: RuntimeSourceWorkspaceEntry): SourceWorkspaceLayer {
  const contract = entry.slots.find((slot) => slot.name === "content");
  return {
    id: `${entry.id}:design-slot:content`,
    label: "content",
    kind: "slot",
    source: { start: entry.source.end, end: entry.source.end },
    children: [],
    ...(contract ? { slotContract: contract } : {}),
  };
}

function lowerCamel(value: string): string {
  const clean = value.replace(/[^A-Za-z0-9_$]+/g, " ").trim();
  const [first = "content", ...rest] = clean.split(/\s+/);
  return `${first.charAt(0).toLowerCase()}${first.slice(1)}${rest.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join("")}`;
}
