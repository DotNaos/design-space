import { useEffect, useMemo, useState } from "react";

import { projectPreviewSlots, type SelectionTarget } from "../../model";
import type { TailwindPreview } from "../../shared/contracts";
import type { DesignDocument, DesignValue } from "../../shared/design-document";
import { collectDocumentTailwind } from "../../shared/document-tailwind";
import type { TargetModule } from "../../shared/target-module";
import { runLocalOperation } from "../api";
import { createTargetViewModel, findComponentInstance } from "../target-model";
import type { SlotState } from "../types";
import { documentToFixture } from "./fixture-document";
import {
  duplicateDesignComponent,
  findDesignNode,
  findDesignNodeLocation,
  moveDesignComponent,
  removeDesignComponent,
  updateDesignProps,
} from "./document-commands";
import { resolveDocumentAdapter } from "./document-adapters";
import { DesignDocumentPreview } from "./document-runtime";

interface EditorSession {
  draft: DesignDocument;
  selectedInstanceId: string;
}

interface UseDocumentItemEditorOptions {
  target: TargetModule;
  document: DesignDocument;
  library: readonly DesignDocument[];
  connected: boolean;
  sourceSnapshotKey: string;
  createId: () => string;
  onCommit: (document: DesignDocument) => void;
  onSelect: (selection: SelectionTarget) => void;
}

export function useDocumentItemEditor(options: UseDocumentItemEditorOptions) {
  const [session, setSession] = useState<EditorSession>();
  const [previewCss, setPreviewCss] = useState("");
  const [compiledValue, setCompiledValue] = useState<string>();
  const [compileError, setCompileError] = useState<string>();
  const [compilePending, setCompilePending] = useState(false);

  useEffect(() => {
    setSession(undefined);
    setPreviewCss("");
    setCompiledValue(undefined);
    setCompileError(undefined);
    setCompilePending(false);
  }, [options.sourceSnapshotKey]);

  const model = useMemo(() => {
    if (!session?.draft.root) return undefined;
    const fixture = documentToFixture(session.draft);
    const componentDocuments = options.library.filter((document) => document.kind === "component");
    const view = createTargetViewModel(options.target, false, fixture, componentDocuments, { contractValidation: "tolerant" });
    const instance = findComponentInstance(view.root, session.selectedInstanceId) ?? view.root;
    const node = findDesignNode(session.draft.root, instance.instanceId) ?? session.draft.root;
    const adapter = resolveDocumentAdapter(options.target, options.library, node.adapterId);
    if (!adapter) return undefined;
    const props = { ...adapter.defaultProps, ...node.props };
    const controlValues = Object.fromEntries(adapter.controls.map((control) => [
      control.prop,
      props[control.prop],
    ])) as Readonly<Record<string, DesignValue | undefined>>;
    const tailwindInput = collectDocumentTailwind(options.target, options.library, session.draft);
    const location = findDesignNodeLocation(session.draft.root, instance.instanceId);
    const parentNode = location ? findDesignNode(session.draft.root, location.parentInstanceId) : undefined;
    const parentAdapter = parentNode ? resolveDocumentAdapter(options.target, options.library, parentNode.adapterId) : undefined;
    const parentSlot = parentAdapter?.component.slots.find((slot) => slot.id === location?.slotId);
    const slots: SlotState[] = projectPreviewSlots(view.catalog, instance, { contractValidation: "tolerant" }).map((slot) => ({
      ...(() => {
        const definition = adapter.component.slots.find((candidate) => candidate.id === slot.selection.slotId);
        return {
          min: definition?.min,
          max: definition?.max,
          accepts: definition?.accepts,
          acceptedLabels: definition?.accepts?.map((adapterId) => resolveDocumentAdapter(options.target, options.library, adapterId)?.component.label ?? adapterId),
          acceptsText: definition?.acceptsText,
        };
      })(),
      id: slot.selection.slotId,
      selectionId: slot.selection.id,
      label: slot.label,
      count: slot.childCount,
      childLabel: childLabel(options.target, options.library, node, slot.selection.slotId),
    }));
    return {
      session,
      view,
      instance,
      node,
      adapter,
      controlValues,
      tailwindInput,
      location,
      slots,
      hasTailwind: tailwindInput.length > 0,
      canDelete: instance.instanceId === session.draft.root.instanceId
        || Boolean(location && parentSlot && location.siblingCount > (parentSlot.min ?? 0)),
      canDuplicate: Boolean(location && (!parentSlot?.max || location.siblingCount < parentSlot.max)),
    };
  }, [options.library, options.target, session]);

  useEffect(() => {
    if (!model?.hasTailwind) {
      setPreviewCss("");
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
          setPreviewCss(result.css);
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
  }, [model?.hasTailwind, model?.tailwindInput, options.connected]);

  const open = (instanceId: string) => {
    if (!findDesignNode(options.document.root, instanceId)) return;
    setSession({ draft: options.document, selectedInstanceId: instanceId });
    setCompileError(undefined);
  };

  const updateControl = (prop: string, value: DesignValue | undefined) => {
    setSession((current) => current
      ? { ...current, draft: updateDesignProps(current.draft, current.selectedInstanceId, { [prop]: value }) }
      : current);
  };

  const move = (offset: -1 | 1) => setSession((current) => current
    ? { ...current, draft: moveDesignComponent(current.draft, current.selectedInstanceId, offset) }
    : current);

  const duplicate = () => {
    if (!model?.canDuplicate) return;
    setSession((current) => {
      if (!current) return current;
      const duplicate = duplicateDesignComponent(current.draft, current.selectedInstanceId, options.createId);
      return { draft: duplicate.document, selectedInstanceId: duplicate.duplicateId };
    });
  };

  const remove = () => {
    if (!model?.canDelete) return;
    if (!model.location) {
      options.onCommit(removeDesignComponent(model.session.draft, model.instance.instanceId));
      setSession(undefined);
      return;
    }
    setSession((current) => current ? {
      draft: removeDesignComponent(current.draft, current.selectedInstanceId),
      selectedInstanceId: model.location!.parentInstanceId,
    } : current);
  };

  const apply = () => {
    if (!model || compilePending || compileError || (model.hasTailwind && compiledValue !== model.tailwindInput)) return;
    options.onCommit(model.session.draft);
    options.onSelect({ kind: "component", id: model.instance.instanceId });
    setSession(undefined);
  };

  return {
    model: model && {
      ...model,
      preview: <DesignDocumentPreview target={options.target} document={model.session.draft} library={options.library} />,
      previewCss,
      compileError,
      compilePending,
      sourceBacked: true,
    },
    open,
    close: () => setSession(undefined),
    updateControl,
    selectComponent: (instanceId: string) => setSession((current) => current && findDesignNode(current.draft.root, instanceId)
      ? { ...current, selectedInstanceId: instanceId }
      : current),
    move,
    duplicate,
    remove,
    apply,
  };
}

export { collectDocumentTailwind };

function childLabel(
  target: TargetModule,
  library: readonly DesignDocument[],
  parent: NonNullable<DesignDocument["root"]>,
  slotId: string,
): string | undefined {
  const child = parent.slots[slotId]?.[0];
  if (!child) return undefined;
  if (child.kind === "text") return "Text";
  if (child.kind === "slot-outlet") return "Slot outlet";
  return resolveDocumentAdapter(target, library, child.node.adapterId)?.component.label;
}
