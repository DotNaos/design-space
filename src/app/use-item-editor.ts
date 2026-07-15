import { useEffect, useMemo, useState } from "react";

import { isValidRequiredControlValue, projectPreviewSlots, type SelectionTarget } from "../model";
import type { TailwindPreview } from "../shared/contracts";
import type { DesignValue } from "../shared/design-document";
import type { ComponentFixture, TargetModule } from "../shared/target-module";
import { runLocalOperation } from "./api";
import {
  createTargetViewModel,
  duplicateFixtureComponent,
  findComponentFixture,
  findComponentInstance,
  findFixtureLocation,
  moveFixtureComponent,
  removeFixtureComponent,
  renderTargetFixture,
  resolveFixtureProps,
  updateFixtureProps,
} from "./target-model";
import type { SlotState } from "./types";

type ItemEditorSession = {
  draftFixture: ComponentFixture;
  selectedInstanceId: string;
  rootClassValue: string;
};

type UseItemEditorOptions = {
  target: TargetModule;
  fixture: ComponentFixture;
  rootClassValue: string;
  connected: boolean;
  basePreviewCss: string;
  compositionCss: Readonly<Record<string, string>>;
  createId: () => string;
  onCommitFixture: (fixture: ComponentFixture, metadata?: { undoRootEdit?: boolean }) => void;
  onApplyRootClass: (value: string) => void;
  onApplyCompositionCss: (instanceId: string, css: string) => void;
  onSelect: (selection: SelectionTarget) => void;
};

export function useItemEditor(options: UseItemEditorOptions) {
  const [session, setSession] = useState<ItemEditorSession>();
  const [compiledCss, setCompiledCss] = useState("");
  const [compiledValue, setCompiledValue] = useState<string>();
  const [compileError, setCompileError] = useState<string>();
  const [compilePending, setCompilePending] = useState(false);

  const model = useMemo(() => {
    if (!session) return undefined;
    const view = createTargetViewModel(options.target, false, session.draftFixture);
    const instance = findComponentInstance(view.root, session.selectedInstanceId) ?? view.root;
    const fixture = findComponentFixture(session.draftFixture, instance.instanceId) ?? session.draftFixture;
    const adapter = options.target.adapters.find((candidate) => candidate.component.id === instance.componentId);
    if (!adapter) return undefined;
    const props = resolveFixtureProps(options.target, fixture);
    const controlValues = Object.fromEntries((adapter.controls ?? []).map((control) => {
      const value = instance.instanceId === view.root.instanceId && control.prop === "className"
        ? session.rootClassValue
        : toDesignValue(props[control.prop]);
      return [control.prop, value !== undefined ? value : control.required ? defaultControlValue(control.kind) : undefined];
    })) as Readonly<Record<string, DesignValue | undefined>>;
    const tailwindInput = collectTailwindValues(options.target, session.draftFixture, session.rootClassValue);
    const location = findFixtureLocation(session.draftFixture, instance.instanceId);
    const parent = location ? findComponentInstance(view.root, location.parentInstanceId) : undefined;
    const parentAdapter = options.target.adapters.find((candidate) => candidate.component.id === parent?.componentId);
    const parentSlot = parentAdapter?.component.slots.find((slot) => slot.id === location?.slotId);
    const slots: SlotState[] = projectPreviewSlots(view.catalog, instance).map((slot) => ({
      id: slot.selection.slotId,
      selectionId: slot.selection.id,
      label: slot.label,
      count: slot.childCount,
      childLabel: childLabel(options.target, fixture, slot.selection.slotId),
    }));
    return {
      session,
      view,
      instance,
      fixture,
      adapter,
      props,
      controlValues,
      tailwindInput,
      location,
      slots,
      hasTailwind: options.target.adapters.some((candidate) => candidate.controls?.some((control) => control.kind === "tailwind")),
      canDelete: Boolean(location && parentSlot && location.siblingCount > (parentSlot.min ?? 0)),
      canDuplicate: Boolean(location && (!parentSlot?.max || location.siblingCount < parentSlot.max)),
    };
  }, [options.target, session]);

  useEffect(() => {
    if (!model?.hasTailwind) {
      setCompilePending(false);
      setCompileError(undefined);
      setCompiledValue(model?.tailwindInput);
      return;
    }
    if (!options.connected) {
      setCompilePending(false);
      setCompileError("The registered local target is not connected.");
      return;
    }
    let cancelled = false;
    setCompilePending(true);
    const timer = window.setTimeout(async () => {
      try {
        const result = await runLocalOperation<TailwindPreview>({ type: "compile-tailwind", value: model.tailwindInput });
        if (!cancelled) {
          setCompiledCss(result.css);
          setCompiledValue(result.value);
          setCompileError(undefined);
          setCompilePending(false);
        }
      } catch (error) {
        if (!cancelled) {
          setCompileError(error instanceof Error ? error.message : "The Tailwind preview failed.");
          setCompilePending(false);
        }
      }
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [model?.tailwindInput, model?.hasTailwind, options.connected]);

  const open = (instanceId: string) => {
    if (!findComponentFixture(options.fixture, instanceId)) return;
    setSession({
      draftFixture: options.fixture,
      selectedInstanceId: instanceId,
      rootClassValue: options.rootClassValue,
    });
    setCompileError(undefined);
  };

  const updateControl = (prop: string, value: DesignValue | undefined) => {
    setSession((current) => {
      if (!current) return current;
      const fixture = findComponentFixture(current.draftFixture, current.selectedInstanceId);
      const adapter = options.target.adapters.find((candidate) => candidate.component.id === fixture?.adapterId);
      const control = adapter?.controls?.find((candidate) => candidate.prop === prop);
      if (!fixture || !adapter || !control) return current;
      if (value === undefined && control.required && !isValidRequiredControlValue(control, adapter.defaultProps?.[prop])) return current;
      if (prop === "className" && typeof value === "string" && current.selectedInstanceId === current.draftFixture.instanceId && options.target.defaultEditTargetId) {
        return { ...current, rootClassValue: value };
      }
      return {
        ...current,
        draftFixture: updateFixtureProps(current.draftFixture, current.selectedInstanceId, { [prop]: value }),
      };
    });
  };

  const move = (offset: -1 | 1) => {
    setSession((current) => current
      ? { ...current, draftFixture: moveFixtureComponent(current.draftFixture, current.selectedInstanceId, offset) }
      : current);
  };

  const duplicate = () => {
    if (!model?.canDuplicate) return;
    setSession((current) => {
      if (!current) return current;
      const result = duplicateFixtureComponent(current.draftFixture, current.selectedInstanceId, options.createId);
      return { ...current, draftFixture: result.fixture, selectedInstanceId: result.duplicateId };
    });
  };

  const remove = () => {
    if (!model?.canDelete || !model.location) return;
    setSession((current) => current
      ? {
          ...current,
          draftFixture: removeFixtureComponent(current.draftFixture, current.selectedInstanceId),
          selectedInstanceId: model.location!.parentInstanceId,
        }
      : current);
  };

  const apply = () => {
    if (!model || compilePending || compileError) return;
    if (model.hasTailwind && compiledValue !== model.tailwindInput) return;
    createTargetViewModel(options.target, false, model.session.draftFixture);
    const rootChanged = model.session.rootClassValue !== options.rootClassValue;
    const fixtureChanged = model.session.draftFixture !== options.fixture;
    options.onCommitFixture(model.session.draftFixture, { undoRootEdit: rootChanged });
    if (rootChanged) {
      options.onApplyRootClass(model.session.rootClassValue);
    }
    if (fixtureChanged && model.hasTailwind) options.onApplyCompositionCss("item-editor", compiledCss);
    options.onSelect({ kind: "component", id: model.instance.instanceId });
    setSession(undefined);
  };

  return {
    model: model && {
      ...model,
      preview: renderTargetFixture(options.target, model.session.draftFixture, { className: model.session.rootClassValue }),
      previewCss: `${options.basePreviewCss}\n${Object.values(options.compositionCss).join("\n")}\n${compiledCss}`,
      compileError,
      compilePending,
      sourceBacked: Boolean(options.target.defaultEditTargetId)
        && model.instance.instanceId === model.view.root.instanceId
        && model.adapter.controls?.some((control) => control.kind === "tailwind" && control.prop === "className") === true,
    },
    open,
    close: () => setSession(undefined),
    updateControl,
    selectComponent: (instanceId: string) => setSession((current) => current && findComponentFixture(current.draftFixture, instanceId)
      ? { ...current, selectedInstanceId: instanceId }
      : current),
    move,
    duplicate,
    remove,
    apply,
  };
}

function defaultControlValue(kind: string): DesignValue {
  if (kind === "boolean") return false;
  if (kind === "number") return 0;
  return "";
}

function toDesignValue(value: unknown): DesignValue | undefined {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
}

export function collectTailwindValues(target: TargetModule, fixture: ComponentFixture, rootClassValue: string): string {
  const adapter = target.adapters.find((candidate) => candidate.component.id === fixture.adapterId);
  const props = resolveFixtureProps(target, fixture);
  const own = (adapter?.controls ?? [])
    .filter((control) => control.kind === "tailwind")
    .map((control) => fixture.instanceId === target.defaultFixture.instanceId && control.prop === "className"
      ? rootClassValue
      : typeof props[control.prop] === "string" ? props[control.prop] : "");
  const nested = Object.values(fixture.slots).flatMap((children) => children.flatMap((child) => child.kind === "component"
    ? [collectTailwindValues(target, child.node, rootClassValue)]
    : []));
  return [...own, ...nested].filter(Boolean).join(" ");
}

function childLabel(target: TargetModule, parent: ComponentFixture, slotId: string) {
  const child = parent.slots[slotId]?.[0];
  if (!child) return undefined;
  if (child.kind === "text") return "Text";
  return target.adapters.find((adapter) => adapter.component.id === child.node.adapterId)?.component.label;
}
