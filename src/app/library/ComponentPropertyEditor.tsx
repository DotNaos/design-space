import { Button } from "@heroui/react";
import { Plus, Trash2 } from "lucide-react";

import type { ComponentPropertyDraft, DesignValue } from "../../shared/design-document";
import {
  ContractSelect,
  ContractSwitch,
  ContractTextArea,
  ContractTextInput,
  OptionalNumberInput,
  StableIdField,
} from "./ContractEditorFields";

type PropertyKind = ComponentPropertyDraft["kind"];
type PropertyOfKind<Kind extends PropertyKind> = Extract<ComponentPropertyDraft, { kind: Kind }>;

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

function DefaultValueEditor(props: ComponentPropertyEditorProps) {
  const { property } = props;
  if (property.kind === "boolean") {
    return <ContractSwitch label="Default value" selected={property.defaultValue === true} onChange={(defaultValue) => props.onChange({ ...property, defaultValue })} />;
  }
  if (property.kind === "number") {
    return (
      <OptionalNumberInput
        label="Default value"
        max={property.max}
        min={property.min}
        step={property.step}
        value={typeof property.defaultValue === "number" ? property.defaultValue : 0}
        onChange={(defaultValue) => props.onChange({ ...property, defaultValue: defaultValue ?? 0 })}
      />
    );
  }
  if (property.kind === "select") {
    const selectedIndex = Math.max(0, property.options.findIndex((option) => option.value === property.defaultValue));
    return (
      <ContractSelect
        label="Default value"
        options={property.options.map((option, index) => ({ value: String(index), label: option.label }))}
        value={String(selectedIndex)}
        onChange={(index) => props.onChange({ ...property, defaultValue: property.options[Number(index)]?.value ?? property.options[0].value })}
      />
    );
  }
  const value = typeof property.defaultValue === "string" ? property.defaultValue : "";
  if (property.kind === "text" && property.multiline) {
    return <ContractTextArea label="Default value" value={value} onChange={(defaultValue) => props.onChange({ ...property, defaultValue })} />;
  }
  return <ContractTextInput label="Default value" value={value} onChange={(defaultValue) => props.onChange({ ...property, defaultValue })} />;
}

function KindFields(props: ComponentPropertyEditorProps) {
  if (props.property.kind === "text") return <TextFields property={props.property} onChange={props.onChange} />;
  if (props.property.kind === "tailwind") return <TailwindFields property={props.property} onChange={props.onChange} />;
  if (props.property.kind === "number") return <NumberFields property={props.property} onChange={props.onChange} />;
  if (props.property.kind === "select") return <SelectFields property={props.property} onChange={props.onChange} />;
  return <p className="text-[10px] leading-4 text-zinc-600">Boolean properties have no additional constraints.</p>;
}

function TextFields(props: { property: PropertyOfKind<"text">; onChange: (property: ComponentPropertyDraft) => void }) {
  const setMaxLength = (maxLength: number | undefined) => {
    const next = { ...props.property };
    if (maxLength === undefined) delete next.maxLength;
    else next.maxLength = maxLength;
    props.onChange(next);
  };
  const setPlaceholder = (placeholder: string) => {
    const next = { ...props.property };
    if (placeholder === "") delete next.placeholder;
    else next.placeholder = placeholder;
    props.onChange(next);
  };
  return (
    <div className="space-y-3 border-t border-white/5 pt-3">
      <h4 className="text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500">Text constraints</h4>
      <ContractSwitch label="Multiline" selected={props.property.multiline === true} onChange={(multiline) => props.onChange({ ...props.property, multiline })} />
      <OptionalNumberInput integer label="Maximum length" min={1} placeholder="No limit" value={props.property.maxLength} onChange={setMaxLength} />
      <ContractTextInput label="Placeholder" value={props.property.placeholder ?? ""} onChange={setPlaceholder} />
    </div>
  );
}

function TailwindFields(props: { property: PropertyOfKind<"tailwind">; onChange: (property: ComponentPropertyDraft) => void }) {
  const presets = props.property.presets ?? [];
  const addPreset = () => props.onChange({
    ...props.property,
    presets: [...presets, { id: uniqueId("preset", new Set(presets.map((preset) => preset.id))), label: `Preset ${presets.length + 1}`, value: "" }],
  });
  const updatePreset = (index: number, patch: Partial<(typeof presets)[number]>) => props.onChange({
    ...props.property,
    presets: presets.map((preset, item) => item === index ? { ...preset, ...patch } : preset),
  });
  const removePreset = (index: number) => props.onChange({ ...props.property, presets: presets.filter((_, item) => item !== index) });
  return (
    <div className="space-y-3 border-t border-white/5 pt-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500">Tailwind presets</h4>
        <Button size="sm" variant="ghost" onPress={addPreset}><Plus size={12} /> Preset</Button>
      </div>
      {presets.length === 0 ? <p className="text-[10px] text-zinc-600">No presets. Free-form Tailwind classes remain available.</p> : null}
      {presets.map((preset, index) => (
        <div key={preset.id} className="space-y-2 border-t border-white/5 pt-3 first:border-t-0 first:pt-0">
          <div className="flex items-center justify-between gap-2">
            <code className="truncate font-mono text-[9px] text-emerald-400/70">{preset.id}</code>
            <Button aria-label={`Remove ${preset.label} preset`} isIconOnly size="sm" variant="ghost" onPress={() => removePreset(index)}><Trash2 size={12} /></Button>
          </div>
          <ContractTextInput label={`Preset ${index + 1} label`} value={preset.label} onChange={(label) => updatePreset(index, { label })} />
          <ContractTextInput label={`Preset ${index + 1} classes`} value={preset.value} onChange={(value) => updatePreset(index, { value })} />
        </div>
      ))}
    </div>
  );
}

function NumberFields(props: { property: PropertyOfKind<"number">; onChange: (property: ComponentPropertyDraft) => void }) {
  const setNumber = (key: "min" | "max" | "step", value: number | undefined) => {
    const next = { ...props.property };
    if (value === undefined) {
      delete next[key];
    } else if (key === "min" && props.property.max !== undefined && value > props.property.max) {
      next.min = value;
      next.max = value;
    } else if (key === "max" && props.property.min !== undefined && value < props.property.min) {
      next.min = value;
      next.max = value;
    } else {
      next[key] = value;
    }
    props.onChange(next);
  };
  const setUnit = (unit: string) => {
    const next = { ...props.property };
    if (unit === "") delete next.unit;
    else next.unit = unit;
    props.onChange(next);
  };
  return (
    <div className="space-y-3 border-t border-white/5 pt-3">
      <h4 className="text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500">Number constraints</h4>
      <div className="grid grid-cols-2 gap-2">
        <OptionalNumberInput label="Minimum" value={props.property.min} onChange={(value) => setNumber("min", value)} />
        <OptionalNumberInput label="Maximum" value={props.property.max} onChange={(value) => setNumber("max", value)} />
        <OptionalNumberInput label="Step" min={Number.EPSILON} value={props.property.step} onChange={(value) => setNumber("step", value)} />
        <ContractTextInput label="Unit" value={props.property.unit ?? ""} onChange={setUnit} />
      </div>
      {props.property.min !== undefined && props.property.max !== undefined && props.property.min > props.property.max
        ? <p role="alert" className="text-[10px] text-rose-300">Maximum must be at least the minimum.</p>
        : null}
    </div>
  );
}

function SelectFields(props: { property: PropertyOfKind<"select">; onChange: (property: ComponentPropertyDraft) => void }) {
  const addOption = () => {
    const value = uniqueValue("option", new Set(props.property.options.map((option) => option.value)));
    props.onChange({ ...props.property, options: [...props.property.options, { label: `Option ${props.property.options.length + 1}`, value }] });
  };
  const updateOption = (index: number, patch: Partial<PropertyOfKind<"select">["options"][number]>) => {
    const previous = props.property.options[index];
    const options = props.property.options.map((option, item) => item === index ? { ...option, ...patch } : option);
    const next = { ...props.property, options };
    if (props.property.defaultValue === previous.value) next.defaultValue = options[index].value;
    props.onChange(next);
  };
  const removeOption = (index: number) => {
    if (props.property.options.length === 1) return;
    const removed = props.property.options[index];
    const options = props.property.options.filter((_, item) => item !== index);
    const next = { ...props.property, options };
    if (props.property.defaultValue === removed.value) next.defaultValue = options[0].value;
    props.onChange(next);
  };
  return (
    <div className="space-y-3 border-t border-white/5 pt-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500">Select options</h4>
        <Button size="sm" variant="ghost" onPress={addOption}><Plus size={12} /> Option</Button>
      </div>
      {props.property.options.map((option, index) => (
        <div key={index} className="space-y-2 border-t border-white/5 pt-3 first:border-t-0 first:pt-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1">
              {(["text", "number"] as const).map((type) => (
                <Button key={type} aria-label={`Set Option ${index + 1} value type to ${type}`} aria-pressed={(typeof option.value === "number" ? "number" : "text") === type} size="sm" variant={(typeof option.value === "number" ? "number" : "text") === type ? "secondary" : "ghost"} onPress={() => updateOption(index, { value: type === "number" ? Number(option.value) || 0 : String(option.value) })}>{type}</Button>
              ))}
            </div>
            <Button aria-label={`Remove ${option.label} option`} isDisabled={props.property.options.length === 1} isIconOnly size="sm" variant="ghost" onPress={() => removeOption(index)}><Trash2 size={12} /></Button>
          </div>
          <ContractTextInput label={`Option ${index + 1} label`} value={option.label} onChange={(label) => updateOption(index, { label })} />
          {typeof option.value === "number"
            ? <OptionalNumberInput label={`Option ${index + 1} value`} value={option.value} onChange={(value) => updateOption(index, { value: value ?? 0 })} />
            : <ContractTextInput label={`Option ${index + 1} value`} value={option.value} onChange={(value) => updateOption(index, { value })} />}
        </div>
      ))}
    </div>
  );
}

function initialDefault(property: ComponentPropertyDraft): DesignValue {
  if (property.kind === "boolean") return typeof property.defaultValue === "boolean" ? property.defaultValue : false;
  if (property.kind === "number") return typeof property.defaultValue === "number" ? property.defaultValue : property.min ?? 0;
  if (property.kind === "select") return property.options.find((option) => option.value === property.defaultValue)?.value ?? property.options[0].value;
  return typeof property.defaultValue === "string" ? property.defaultValue : "";
}

function uniqueId(initial: string, used: ReadonlySet<string>): string {
  let sequence = 1;
  let candidate = `${initial}-${sequence}`;
  while (used.has(candidate)) candidate = `${initial}-${++sequence}`;
  return candidate;
}

function uniqueValue(initial: string, used: ReadonlySet<string | number>): string {
  let sequence = 1;
  let candidate = `${initial}-${sequence}`;
  while (used.has(candidate)) candidate = `${initial}-${++sequence}`;
  return candidate;
}
