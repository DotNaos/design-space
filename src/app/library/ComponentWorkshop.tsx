import { Button, Disclosure, Input, Label, TextField } from "@heroui/react";
import { Braces, Component, Plus } from "lucide-react";
import { useState } from "react";

import type { ComponentPropertyDraft, DesignDocument } from "../../shared/design-document";
import type { ComponentCreationRecipe } from "../../shared/target-module";
import {
  addComponentProperty,
  addComponentSlot,
  removeComponentProperty,
  updateComponentDefinition,
  updateComponentProperty,
  updateComponentSlot,
} from "../document/document-commands";
import {
  authoredSlotDependencyMessage,
  removeAuthoredSlotDefinition,
} from "../document/workspace-selection-actions";
import { ComponentPropertyEditor } from "./ComponentPropertyEditor";
import { ComponentPropertyBindings, type BindingComponentOption } from "./ComponentPropertyBindings";
import { ComponentSlotEditor } from "./ComponentSlotEditor";

const propertyKinds: ComponentPropertyDraft["kind"][] = ["text", "tailwind", "boolean", "number", "select"];

export function ComponentWorkshop(props: {
  className?: string;
  document: DesignDocument;
  documents: readonly DesignDocument[];
  recipe?: ComponentCreationRecipe;
  catalogComponents: readonly BindingComponentOption[];
  onChange: (document: DesignDocument) => void;
  onEditImplementation: () => void;
}) {
  const definition = props.document.component;
  if (!definition) return null;
  const canAddSlot = Boolean(props.recipe && props.document.root);
  const addSlot = () => {
    if (!props.recipe || !props.document.root) return;
    const sequence = definition.slots.length + 1;
    const slotId = uniqueId(`slot-${sequence}`, new Set(definition.slots.map((slot) => slot.id)));
    props.onChange(addComponentSlot(
      props.document,
      { id: slotId, label: `Slot ${sequence}`, accepts: [], acceptsText: false },
      props.document.root.instanceId,
      props.recipe.rootSlotId,
      () => `${slotId}-outlet`,
    ));
  };
  const addProperty = (kind: ComponentPropertyDraft["kind"]) => {
    const sequence = definition.properties.length + 1;
    const id = uniqueId(`property-${sequence}`, new Set(definition.properties.map((property) => property.id)));
    const base = { id, label: `Property ${sequence}`, prop: id };
    const property: ComponentPropertyDraft = kind === "select"
      ? { ...base, kind, options: [{ label: "Default", value: "default" }] }
      : { ...base, kind };
    props.onChange(addComponentProperty(props.document, property));
  };

  return (
    <aside className={`${props.className ?? "flex w-80"} h-full min-h-0 min-w-0 shrink-0 scroll-pb-[calc(7rem+env(safe-area-inset-bottom))] flex-col overflow-y-auto overscroll-contain border-l border-white/10 bg-[#141518] lg:scroll-pb-0`}>
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#141518]/95 px-4 py-3 backdrop-blur">
        <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-sky-400">Component workshop</p>
        <h2 className="mt-1 text-sm font-semibold text-zinc-100">{definition.label}</h2>
        <p className="mt-1 text-[10px] text-zinc-600">{props.recipe?.label ?? "Target-owned component recipe"}</p>
      </header>

      <WorkshopSection title="Identity">
        <TextField fullWidth value={definition.label} onChange={(label) => props.onChange(updateComponentDefinition(props.document, { label }))}>
          <Label className="text-[10px] text-zinc-500">Name</Label>
          <Input className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-base text-zinc-200 lg:text-sm" />
        </TextField>
        <TextField fullWidth value={definition.group} onChange={(group) => props.onChange(updateComponentDefinition(props.document, { group }))}>
          <Label className="text-[10px] text-zinc-500">Catalog group</Label>
          <Input className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-base text-zinc-200 lg:text-sm" />
        </TextField>
        <TextField fullWidth value={definition.description ?? ""} onChange={(description) => props.onChange(updateComponentDefinition(props.document, { description }))}>
          <Label className="text-[10px] text-zinc-500">Description</Label>
          <Input className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-base text-zinc-200 lg:text-sm" />
        </TextField>
      </WorkshopSection>

      <WorkshopSection title="Slots" action={<Button isDisabled={!canAddSlot} size="sm" variant="ghost" onPress={addSlot}><Plus size={13} /> Slot</Button>}>
        <p className="text-[10px] leading-4 text-zinc-600">{canAddSlot ? "Children are accepted only through these explicit slots. Every new slot gets an outlet in the implementation." : "This target did not register an outlet placement recipe, so new slots are disabled safely."}</p>
        {definition.slots.map((slot) => (
          <ComponentSlotEditor
            key={slot.id}
            slot={slot}
            catalogComponents={props.catalogComponents}
            removeBlockedReason={authoredSlotDependencyMessage(props.document, props.documents, slot.id)}
            onChange={(nextSlot) => props.onChange(updateComponentSlot(props.document, slot.id, () => nextSlot))}
            onRemove={() => {
              const result = removeAuthoredSlotDefinition({
                document: props.document,
                documents: props.documents,
                slotId: slot.id,
                selection: { kind: "component", id: props.document.root?.instanceId ?? "empty-implementation" },
              });
              if (result.status === "applied") props.onChange(result.document);
            }}
          />
        ))}
      </WorkshopSection>

      <WorkshopSection title="Properties / arguments">
        <p className="text-[10px] leading-4 text-zinc-600">Define the typed arguments exposed by this component, including defaults, required values, and allowed options.</p>
        <div className="flex flex-wrap gap-1.5">
          {propertyKinds.map((kind) => <Button key={kind} size="sm" variant="secondary" onPress={() => addProperty(kind)}><Plus size={11} />{kind}</Button>)}
        </div>
        {definition.properties.map((property) => (
          <ComponentPropertyEditor
            key={property.id}
            property={property}
            onChange={(nextProperty) => props.onChange(updateComponentProperty(props.document, property.id, () => nextProperty))}
            onRemove={() => props.onChange(removeComponentProperty(props.document, property.id))}
          />
        ))}
        <ComponentPropertyBindings document={props.document} catalogComponents={props.catalogComponents} onChange={props.onChange} />
      </WorkshopSection>

      <WorkshopSection title="Implementation">
        <Button className="w-full" isDisabled={!props.document.root} variant="secondary" onPress={props.onEditImplementation}><Component size={14} /> Edit component body</Button>
        <p className="mt-2 flex items-start gap-2 text-[10px] leading-4 text-zinc-600"><Braces size={13} className="mt-0.5 shrink-0" />{props.document.root ? "The body executes registered React adapters directly. Slot outlets stay explicit in the document." : "Add a root component to start the component body."}</p>
      </WorkshopSection>
    </aside>
  );
}

function WorkshopSection(props: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <Disclosure className="border-b border-white/10 px-4 py-4" isExpanded={expanded} onExpandedChange={setExpanded}>
      <Disclosure.Heading className={`${expanded ? "mb-3" : ""} flex min-h-9 items-center gap-2`}>
        <Disclosure.Trigger className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left lg:min-h-8">
          <Disclosure.Indicator className="shrink-0 text-zinc-600" />
          <span className="truncate text-xs font-semibold text-zinc-300">{props.title}</span>
        </Disclosure.Trigger>
        {props.action}
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body className="space-y-3 p-0">{props.children}</Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
}

function uniqueId(initial: string, used: ReadonlySet<string>): string {
  let candidate = initial;
  let suffix = 2;
  while (used.has(candidate)) candidate = `${initial}-${suffix++}`;
  return candidate;
}
