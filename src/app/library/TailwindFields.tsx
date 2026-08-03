import { Button } from "@heroui/react";
import { Plus, Trash2 } from "lucide-react";
import type { ComponentPropertyDraft } from "../../shared/design-document";
import { ContractTextInput } from "./ContractEditorFields";
import { PropertyOfKind, uniqueId } from "./ComponentPropertyEditor";

export function TailwindFields(props: { property: PropertyOfKind<"tailwind">; onChange: (property: ComponentPropertyDraft) => void }) {
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
        <h4 className="text-[10px] font-medium text-zinc-500">Tailwind presets</h4>
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
