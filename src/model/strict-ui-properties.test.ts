import { describe, expect, it } from "vitest";

import type { ComponentControl } from "../shared/contracts";
import type { ComponentPropertyDraft, DesignDocument } from "../shared/design-document";
import type { TargetModule } from "../shared/target-module";
import { validateStrictUi } from "./strict-ui";

function target(
  controls: ComponentControl[],
  defaultProps?: Record<string, string | number | boolean | null>,
): TargetModule {
  return {
    project: { id: "demo", label: "Demo" },
    defaultAdapterId: "implementation",
    defaultFixture: { instanceId: "implementation.default", adapterId: "implementation", slots: {} },
    files: [],
    adapters: [{
      component: { id: "implementation", label: "Implementation", group: "Custom", slots: [] },
      controls,
      defaultProps,
      render: () => null,
    }],
  };
}

function component(
  properties: ComponentPropertyDraft[],
  propertyBindings: Record<string, string>,
): DesignDocument {
  return {
    schemaVersion: 2,
    id: "component.bound",
    label: "Bound component",
    kind: "component",
    component: { id: "bound", label: "Bound", group: "Custom", properties, slots: [] },
    root: { instanceId: "bound.root", adapterId: "implementation", propertyBindings, slots: {} },
  };
}

const requiredTitle: ComponentControl = {
  id: "title",
  label: "Title",
  kind: "text",
  prop: "title",
  required: true,
};

describe("Strict UI public property defaults", () => {
  it("lets a valid public default satisfy a required implementation property", () => {
    const document = component(
      [{ id: "public-title", label: "Title", kind: "text", prop: "title", required: true, defaultValue: "Planning" }],
      { title: "public-title" },
    );

    expect(validateStrictUi(target([requiredTitle]), document)).toEqual([]);
  });

  it("lets a required public contract satisfy a required implementation property", () => {
    const document = component(
      [{ id: "public-title", label: "Title", kind: "text", prop: "title", required: true }],
      { title: "public-title" },
    );

    expect(validateStrictUi(target([requiredTitle]), document)).toEqual([]);
  });

  it("preserves an optional implementation fallback for an unset optional public property", () => {
    const document = component(
      [{ id: "public-title", label: "Title", kind: "text", prop: "title" }],
      { title: "public-title" },
    );
    const optionalTitle = { ...requiredTitle, required: false };

    expect(validateStrictUi(target([optionalTitle], { title: "Fallback" }), document)).toEqual([]);
  });

  it("rejects an optional public property bound to a required implementation property", () => {
    const document = component(
      [{ id: "public-title", label: "Title", kind: "text", prop: "title", defaultValue: "Fallback" }],
      { title: "public-title" },
    );

    expect(validateStrictUi(target([requiredTitle]), document)).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: "binding.required" }),
    ]));
  });

  it("continues to report an incompatible public binding", () => {
    const document = component(
      [{ id: "public-count", label: "Count", kind: "number", prop: "count", required: true }],
      { title: "public-count" },
    );

    expect(validateStrictUi(target([requiredTitle]), document)).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: "binding.type" }),
    ]));
  });

  it("requires public value constraints to fit the implementation contract", () => {
    const controls: ComponentControl[] = [
      { id: "name", label: "Name", kind: "text", prop: "name", maxLength: 20 },
      { id: "count", label: "Count", kind: "number", prop: "count", min: 1, max: 10 },
      {
        id: "variant",
        label: "Variant",
        kind: "select",
        prop: "variant",
        options: [{ id: "primary", label: "Primary", value: "primary" }],
      },
    ];
    const properties: ComponentPropertyDraft[] = [
      { id: "public-name", label: "Name", kind: "text", prop: "name", maxLength: 40 },
      { id: "public-count", label: "Count", kind: "number", prop: "count", min: 0, max: 100 },
      {
        id: "public-variant",
        label: "Variant",
        kind: "select",
        prop: "variant",
        options: [
          { label: "Primary", value: "primary" },
          { label: "Danger", value: "danger" },
        ],
      },
    ];
    const bindings = { name: "public-name", count: "public-count", variant: "public-variant" };

    expect(validateStrictUi(target(controls), component(properties, bindings))).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: "binding.maxLength" }),
      expect.objectContaining({ ruleId: "binding.minimum" }),
      expect.objectContaining({ ruleId: "binding.maximum" }),
      expect.objectContaining({ ruleId: "binding.options" }),
    ]));
  });

  it("accepts public value constraints that narrow the implementation contract", () => {
    const controls: ComponentControl[] = [
      { id: "name", label: "Name", kind: "text", prop: "name", maxLength: 20 },
      { id: "count", label: "Count", kind: "number", prop: "count", min: 1, max: 10 },
      {
        id: "variant",
        label: "Variant",
        kind: "select",
        prop: "variant",
        options: [
          { id: "primary", label: "Primary", value: "primary" },
          { id: "danger", label: "Danger", value: "danger" },
        ],
      },
    ];
    const properties: ComponentPropertyDraft[] = [
      { id: "public-name", label: "Name", kind: "text", prop: "name", maxLength: 12 },
      { id: "public-count", label: "Count", kind: "number", prop: "count", min: 2, max: 8 },
      {
        id: "public-variant",
        label: "Variant",
        kind: "select",
        prop: "variant",
        options: [{ label: "Primary", value: "primary" }],
      },
    ];
    const bindings = { name: "public-name", count: "public-count", variant: "public-variant" };

    expect(validateStrictUi(target(controls), component(properties, bindings))).toEqual([]);
  });

  it("rejects invalid defaults against every public property contract", () => {
    const properties: ComponentPropertyDraft[] = [
      { id: "required", label: "Required", kind: "text", prop: "required", required: true, defaultValue: "" },
      { id: "short", label: "Short", kind: "text", prop: "short", maxLength: 2, defaultValue: "long" },
      { id: "enabled", label: "Enabled", kind: "boolean", prop: "enabled", defaultValue: "yes" },
      { id: "minimum", label: "Minimum", kind: "number", prop: "minimum", min: 1, defaultValue: 0 },
      { id: "maximum", label: "Maximum", kind: "number", prop: "maximum", max: 3, defaultValue: 4 },
      { id: "variant", label: "Variant", kind: "select", prop: "variant", options: [{ label: "Primary", value: "primary" }], defaultValue: "other" },
      { id: "surface", label: "Surface", kind: "tailwind", prop: "surface", defaultValue: 12 },
    ];
    const controls = properties.map((property): ComponentControl => {
      if (property.kind === "select") {
        return { ...property, options: property.options.map((option, index) => ({ id: `option-${index}`, ...option })) };
      }
      const { defaultValue: _defaultValue, ...control } = property;
      return control;
    });
    const bindings = Object.fromEntries(properties.map((property) => [property.prop, property.id]));

    const rules = validateStrictUi(target(controls), component(properties, bindings))
      .filter((violation) => violation.ruleId.startsWith("definition.default"))
      .map((violation) => violation.ruleId);
    expect(rules).toEqual([
      "definition.default.required",
      "definition.default.maxLength",
      "definition.default.type",
      "definition.default.minimum",
      "definition.default.maximum",
      "definition.default.option",
      "definition.default.type",
    ]);
  });

  it("allows an optional explicit null default", () => {
    const document = component(
      [{ id: "public-title", label: "Title", kind: "text", prop: "title", defaultValue: null }],
      { title: "public-title" },
    );
    const optionalTitle = { ...requiredTitle, required: false };

    expect(validateStrictUi(target([optionalTitle]), document)).toEqual([]);
  });
});
