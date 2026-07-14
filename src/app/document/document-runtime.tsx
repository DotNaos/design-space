import { cloneElement, Fragment, isValidElement, type ReactElement, type ReactNode } from "react";

import { htmlSelectionId, slotSelectionId } from "../../model";
import type {
  ComponentDefinitionDraft,
  DesignChild,
  DesignComponentNode,
  DesignDocument,
} from "../../shared/design-document";
import type { InternalHtmlNode } from "../../shared/contracts";
import type {
  AdapterRenderContext,
  PreviewElementAttributes,
  PreviewSlotAttributes,
  TargetModule,
} from "../../shared/target-module";

export function renderDesignDocument(
  target: TargetModule,
  document: DesignDocument,
  library: readonly DesignDocument[],
): ReactNode {
  const preview = document.kind === "component" && document.component
    ? renderComponentImplementation(target, document, document.component, library)
    : renderNode(target, document.root, library, undefined, {}, []);
  const PreviewRoot = target.previewRoot;
  return PreviewRoot ? <PreviewRoot>{preview}</PreviewRoot> : preview;
}

interface TemplateBindingContext {
  definition: ComponentDefinitionDraft;
  values: Readonly<Record<string, unknown>>;
  externalSlots: DesignComponentNode["slots"];
  externalContext?: TemplateBindingContext;
  publicInstanceId: string;
  callerAuthoredPath: readonly string[];
  mapInternalSelectionsToPublicInstance: boolean;
}

export function DesignDocumentPreview(props: {
  target: TargetModule;
  document: DesignDocument;
  library: readonly DesignDocument[];
}) {
  return renderDesignDocument(props.target, props.document, props.library);
}

function renderNode(
  target: TargetModule,
  node: DesignComponentNode,
  library: readonly DesignDocument[],
  parentSlotSelectionId: string | undefined,
  inheritedProps: Readonly<Record<string, unknown>>,
  authoredPath: readonly string[],
  templateContext?: TemplateBindingContext,
  authoredAttributes?: PreviewElementAttributes,
): ReactNode {
  const boundProps = resolveBoundProps(node, templateContext);
  const adapter = target.adapters.find((item) => item.component.id === node.adapterId);
  if (adapter) {
    const previewAttributes = selectionAttributesFor(node, parentSlotSelectionId, templateContext, authoredAttributes);
    const slotChildren = Object.fromEntries(adapter.component.slots.map((slot) => [
      slot.id,
      (node.slots[slot.id] ?? []).flatMap((child) => renderChild(
        target,
        child,
        library,
        slotSelectionId(node.instanceId, slot.id),
        {},
        {},
        authoredPath,
        templateContext,
      )),
    ]));
    const slotAttributes = Object.fromEntries(adapter.component.slots.map((slot) => [
      slot.id,
      { "data-design-space-slot-id": slotSelectionId(node.instanceId, slot.id) } satisfies PreviewSlotAttributes,
    ]));
    const htmlAttributes = Object.fromEntries(flattenInternalHtml(adapter.component.internalHtml ?? []).map((item) => [
      item.id,
      { "data-design-space-html-id": htmlSelectionId(node.instanceId, item.id) },
    ]));
    const context: AdapterRenderContext = { slotChildren, previewAttributes, slotAttributes, htmlAttributes };
    const rendered = adapter.render({ ...adapter.defaultProps, ...node.props, ...inheritedProps, ...boundProps }, context);
    return withKey(instrumentPreviewNode(rendered, previewAttributes), node.instanceId);
  }

  const authored = library.find((candidate) => candidate.kind === "component" && candidate.component?.id === node.adapterId);
  if (!authored?.component) throw new Error(`Missing adapter: ${node.adapterId}`);
  if (authoredPath.includes(node.adapterId)) {
    throw new Error(`Recursive authored component: ${[...authoredPath, node.adapterId].join(" → ")}`);
  }
  const nextAuthoredPath = [...authoredPath, node.adapterId];
  const externalSlots = node.slots;
  const defaults = Object.fromEntries(authored.component.properties.flatMap((property) => property.defaultValue === undefined
    ? []
    : [[property.prop, property.defaultValue]]));
  const previewAttributes = selectionAttributesFor(node, parentSlotSelectionId, templateContext, authoredAttributes);
  const publicProps = { ...defaults, ...node.props, ...inheritedProps, ...boundProps };
  const scopedTemplate = scopeTemplateNode(authored.root, node.instanceId);
  const bindingContext: TemplateBindingContext = {
    definition: authored.component,
    values: publicProps,
    externalSlots,
    externalContext: templateContext,
    publicInstanceId: previewAttributes["data-design-space-instance-id"],
    callerAuthoredPath: authoredPath,
    mapInternalSelectionsToPublicInstance: true,
  };
  const rendered = renderTemplateNode(
    target,
    scopedTemplate,
    library,
    bindingContext,
    previewAttributes,
    nextAuthoredPath,
  );
  return withKey(rendered, node.instanceId);
}

function renderTemplateNode(
  target: TargetModule,
  template: DesignComponentNode,
  library: readonly DesignDocument[],
  bindingContext: TemplateBindingContext,
  authoredAttributes: PreviewElementAttributes,
  authoredPath: readonly string[],
): ReactNode {
  const adapter = target.adapters.find((item) => item.component.id === template.adapterId);
  if (!adapter) {
    return renderNode(
      target,
      template,
      library,
      undefined,
      {},
      authoredPath,
      bindingContext,
      authoredAttributes,
    );
  }
  const slotChildren = Object.fromEntries(adapter.component.slots.map((slot) => [
    slot.id,
    (template.slots[slot.id] ?? []).flatMap((child) => renderChild(
      target,
      child,
      library,
      slotSelectionId(template.instanceId, slot.id),
      {},
      {},
      authoredPath,
      bindingContext,
    )),
  ]));
  const slotAttributes = Object.fromEntries(adapter.component.slots.map((slot) => [
    slot.id,
    { "data-design-space-slot-id": slotSelectionId(template.instanceId, slot.id) } satisfies PreviewSlotAttributes,
  ]));
  const htmlAttributes = Object.fromEntries(flattenInternalHtml(adapter.component.internalHtml ?? []).map((item) => [
    item.id,
    { "data-design-space-html-id": htmlSelectionId(template.instanceId, item.id) },
  ]));
  const rendered = adapter.render(
    { ...adapter.defaultProps, ...template.props, ...resolveBoundProps(template, bindingContext) },
    { slotChildren, previewAttributes: authoredAttributes, slotAttributes, htmlAttributes },
  );
  return instrumentPreviewNode(rendered, authoredAttributes);
}

function renderChild(
  target: TargetModule,
  child: DesignChild,
  library: readonly DesignDocument[],
  parentSlotSelectionId: string,
  externalSlots: DesignComponentNode["slots"],
  inheritedProps: Readonly<Record<string, unknown>> = {},
  authoredPath: readonly string[] = [],
  templateContext?: TemplateBindingContext,
): ReactNode[] {
  if (child.kind === "text") {
    return [<span key={child.id} data-design-space-parent-slot-id={parentSlotSelectionId} style={{ display: "contents" }}>{child.value}</span>];
  }
  if (child.kind === "slot-outlet") {
    const outletSelectionId = templateContext
      ? slotSelectionId(templateContext.publicInstanceId, child.slotId)
      : parentSlotSelectionId;
    const projectedSlots = templateContext?.externalSlots ?? externalSlots;
    return [
      outletAnchor(child.id, outletSelectionId),
      ...(projectedSlots[child.slotId] ?? []).flatMap((external) => renderChild(
        target,
        external,
        library,
        outletSelectionId,
        {},
        inheritedProps,
        templateContext?.callerAuthoredPath ?? authoredPath,
        templateContext?.externalContext,
      )),
    ];
  }
  return [renderNode(target, child.node, library, parentSlotSelectionId, inheritedProps, authoredPath, templateContext)];
}

function renderComponentImplementation(
  target: TargetModule,
  document: DesignDocument,
  definition: ComponentDefinitionDraft,
  library: readonly DesignDocument[],
): ReactNode {
  const values = Object.fromEntries(definition.properties.flatMap((property) => (
    property.defaultValue === undefined ? [] : [[property.prop, property.defaultValue]]
  )));
  const externalSlots = Object.fromEntries(definition.slots.map((slot) => [slot.id, []]));
  const bindingContext: TemplateBindingContext = {
    definition,
    values,
    externalSlots,
    publicInstanceId: document.root.instanceId,
    callerAuthoredPath: [],
    mapInternalSelectionsToPublicInstance: false,
  };
  return renderTemplateNode(
    target,
    document.root,
    library,
    bindingContext,
    previewAttributesFor(document.root.instanceId),
    [definition.id],
  );
}

function previewAttributesFor(instanceId: string, parentSlotSelectionId?: string): PreviewElementAttributes {
  return {
    "data-design-space-instance-id": instanceId,
    ...(parentSlotSelectionId ? { "data-design-space-parent-slot-id": parentSlotSelectionId } : {}),
  };
}

function selectionAttributesFor(
  node: DesignComponentNode,
  parentSlotSelectionId: string | undefined,
  templateContext: TemplateBindingContext | undefined,
  authoredAttributes: PreviewElementAttributes | undefined,
): PreviewElementAttributes {
  if (authoredAttributes) return authoredAttributes;
  return templateContext?.mapInternalSelectionsToPublicInstance
    ? previewAttributesFor(templateContext.publicInstanceId)
    : previewAttributesFor(node.instanceId, parentSlotSelectionId);
}

function outletAnchor(outletId: string, parentSlotSelectionId: string): ReactElement {
  return (
    <span
      key={`outlet-${outletId}`}
      aria-hidden="true"
      data-design-space-outlet-id={outletId}
      data-design-space-parent-slot-id={parentSlotSelectionId}
      data-design-space-slot-id={parentSlotSelectionId}
      style={{ display: "block", minHeight: 1, minWidth: 1 }}
    />
  );
}

function scopeTemplateNode(node: DesignComponentNode, scope: string): DesignComponentNode {
  return {
    ...node,
    instanceId: `${scope}--${node.instanceId}`,
    slots: Object.fromEntries(Object.entries(node.slots).map(([slotId, children]) => [
      slotId,
      children.map((child) => {
        if (child.kind === "component") return { ...child, node: scopeTemplateNode(child.node, scope) };
        return { ...child, id: `${scope}--${child.id}` };
      }),
    ])),
  };
}

function instrumentPreviewNode(node: ReactNode, attributes: PreviewElementAttributes): ReactNode {
  if (!isValidElement(node) || node.type === Fragment) {
    return <span {...attributes} style={{ display: "contents" }}>{node}</span>;
  }
  return cloneElement(node as ReactElement<Record<string, unknown>>, attributes);
}

function withKey(node: ReactNode, key: string): ReactNode {
  return isValidElement(node) ? cloneElement(node, { key }) : node;
}

function flattenInternalHtml(nodes: readonly InternalHtmlNode[]): readonly InternalHtmlNode[] {
  return nodes.flatMap((node) => [node, ...flattenInternalHtml(node.children ?? [])]);
}

function resolveBoundProps(
  node: DesignComponentNode,
  context: TemplateBindingContext | undefined,
): Readonly<Record<string, unknown>> {
  if (!context) return {};
  const properties = new Map(context.definition.properties.map((property) => [property.id, property]));
  return Object.fromEntries(Object.entries(node.propertyBindings ?? {}).flatMap(([targetProp, propertyId]) => {
    const property = properties.get(propertyId);
    if (!property) return [];
    const value = context.values[property.prop];
    return value === undefined ? [] : [[targetProp, value]];
  }));
}
