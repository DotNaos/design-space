import { Button } from "@heroui/react";
import { Trash2 } from "lucide-react";

import type { ComponentPropertyDraft, DesignValue } from "../../shared/design-document";
import { ContractSelect, ContractSwitch, ContractTextArea, ContractTextInput, StableIdField } from "./ContractEditorFields";
import { DefaultValueEditor } from "./DefaultValueEditor";
import { KindFields } from "./KindFields";

type PropertyKind = ComponentPropertyDraft["kind"];
export type PropertyOfKind<Kind extends PropertyKind> = Extract<ComponentPropertyDraft, { kind: Kind }>;

const propertyKinds: readonly PropertyKind[] = ["text", "tailwind", "boolean", "number", "select"];
const sections = [
  { value: "", label: "No section" },
  { value: "content", label: "Content" },
  { value: "layout", label: "Layout" },
  { value: "style", label: "Style" },
  { value: "behavior", label: "Behavior" },
  { value: "advanced", label: "Advanced" },
] as const;

export interface ComponentPropertyEditorProps {
  property: ComponentPropertyDraft;
  onChange: (property: ComponentPropertyDraft) => void;
  onRemove?: () => void;
}

export function ComponentPropertyEditor(props: ComponentPropertyEditorProps) {
  const { property } = props;
  const hasDefault = property.defaultValue !== undefined;

  const setSection = (value: string) => {
    const next = { ...property };
    if (value === "") delete next.section;
    else next.section = value as NonNullable<ComponentPropertyDraft["section"]>;
    props.onChange(next);
  };

  const setDescription = (description: string) => {
    const next = { ...property };
    if (description === "") delete next.description;
    else next.description = description;
    props.onChange(next);
  };

  const setHasDefault = (enabled: boolean) => {
    if (enabled) {
      props.onChange({ ...property, defaultValue: initialDefault(property) });
      return;
    }
    const { defaultValue: _removed, ...next } = property;
    props.onChange(next);
  };

  return (
    <section aria-label={`${property.label} property contract`} className="space-y-4 border-y border-white/10 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1"><StableIdField id={property.id} /></div>
        {props.onRemove ? (
          <Button aria-label={`Remove ${property.label} property`} isIconOnly size="sm" variant="ghost" onPress={props.onRemove}>
            <Trash2 size={14} />
          </Button>
        ) : null}
      </div>

      <fieldset>
        <legend className="text-[10px] text-zinc-500">Property kind</legend>
        <div className="mt-1 flex flex-wrap gap-1">
          {propertyKinds.map((kind) => (
            <Button
              key={kind}
              aria-pressed={property.kind === kind}
              className="min-h-10 capitalize"
              size="sm"
              variant={property.kind === kind ? "secondary" : "ghost"}
              onPress={() => props.onChange(changePropertyKind(property, kind))}
            >
              {kind}
            </Button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <ContractTextInput label="Property label" value={property.label} onChange={(label) => props.onChange({ ...property, label })} />
        <ContractTextInput label="React prop" value={property.prop} onChange={(prop) => props.onChange({ ...property, prop })} />
      </div>
      <ContractSelect label="Inspector section" options={sections} value={property.section ?? ""} onChange={setSection} />
      <ContractTextArea label="Description" rows={2} value={property.description ?? ""} onChange={setDescription} />

      <div className="grid gap-2 sm:grid-cols-2">
        <ContractSwitch label="Required" selected={property.required === true} onChange={(required) => props.onChange({ ...property, required })} />
        <ContractSwitch label="Has default value" selected={hasDefault} onChange={setHasDefault} />
      </div>

      {hasDefault ? <DefaultValueEditor property={property} onChange={props.onChange} /> : null}
      <KindFields property={property} onChange={props.onChange} />
    </section>
  );
}

export function changePropertyKind(property: ComponentPropertyDraft, kind: PropertyKind): ComponentPropertyDraft {
  if (property.kind === kind) return property;
  const base = {
    id: property.id,
    label: property.label,
    prop: property.prop,
    ...(property.section ? { section: property.section } : {}),
    ...(property.description ? { description: property.description } : {}),
    ...(property.required !== undefined ? { required: property.required } : {}),
  };
  const hasDefault = property.defaultValue !== undefined;
  const addDefault = <Draft extends ComponentPropertyDraft>(draft: Draft): Draft => (
    hasDefault ? { ...draft, defaultValue: initialDefault(draft) } : draft
  );
  if (kind === "text") return addDefault({ ...base, kind });
  if (kind === "tailwind") return addDefault({ ...base, kind });
  if (kind === "boolean") return addDefault({ ...base, kind });
  if (kind === "number") return addDefault({ ...base, kind });
  return addDefault({ ...base, kind, options: [{ label: "Default", value: "default" }] });
}

function initialDefault(property: ComponentPropertyDraft): DesignValue {
  if (property.kind === "boolean") return typeof property.defaultValue === "boolean" ? property.defaultValue : false;
  if (property.kind === "number") return typeof property.defaultValue === "number" ? property.defaultValue : property.min ?? 0;
  if (property.kind === "select") return property.options.find((option) => option.value === property.defaultValue)?.value ?? property.options[0].value;
  return typeof property.defaultValue === "string" ? property.defaultValue : "";
}

export function uniqueId(initial: string, used: ReadonlySet<string>): string {
  let sequence = 1;
  let candidate = `${initial}-${sequence}`;
  while (used.has(candidate)) candidate = `${initial}-${++sequence}`;
  return candidate;
}

export function uniqueValue(initial: string, used: ReadonlySet<string | number>): string {
  let sequence = 1;
  let candidate = `${initial}-${sequence}`;
  while (used.has(candidate)) candidate = `${initial}-${++sequence}`;
  return candidate;
}
