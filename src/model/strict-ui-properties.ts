import type { ComponentControl } from "../shared/contracts";
import type { ComponentPropertyDraft, DesignComponentNode } from "../shared/design-document";
import type { StrictUiLocation, StrictUiViolation } from "../shared/strict-ui";
import type { ComponentAdapter } from "../shared/target-module";

type StrictControl = ComponentControl & {
  required?: boolean;
  options?: readonly { value: string | number }[];
};

export function validatePublicPropertyDefaults(
  properties: readonly ComponentPropertyDraft[],
  violations: StrictUiViolation[],
): void {
  for (const property of properties) {
    if (property.defaultValue === undefined) continue;
    const location: StrictUiLocation = { kind: "document" };
    if (property.defaultValue === null) {
      if (property.required) violations.push(defaultIssue("required", `${property.label} cannot use an empty required default.`, location));
      continue;
    }
    if (property.required && property.defaultValue === "") {
      violations.push(defaultIssue("required", `${property.label} cannot use an empty required default.`, location));
      continue;
    }
    validateValue(property, property.defaultValue, location, "definition.default", violations);
  }
}

export function validateControls(
  adapter: ComponentAdapter,
  node: DesignComponentNode,
  publicProperties: ReadonlyMap<string, ComponentPropertyDraft>,
  violations: StrictUiViolation[],
): void {
  const controls = (adapter.controls ?? []) as readonly StrictControl[];
  const declaredProps = new Set(controls.map((control) => control.prop));
  for (const prop of Object.keys(node.props ?? {})) {
    if (!declaredProps.has(prop)) {
      violations.push(issue(
        "property.undeclared",
        `${adapter.component.label} does not declare the ${prop} property.`,
        { kind: "control", instanceId: node.instanceId, controlId: prop },
      ));
    }
  }
  for (const control of controls) validateControl(adapter, node, control, publicProperties, violations);
}

export function validatePropertyBindingContract(
  property: ComponentPropertyDraft,
  control: ComponentControl,
  location: StrictUiLocation,
  violations: StrictUiViolation[],
): void {
  if (control.required && !property.required) {
    violations.push(issue(
      "binding.required",
      `${property.label} must be required before it can supply required ${control.label}.`,
      location,
    ));
  }
  if (property.kind === "text" && control.kind === "text" && control.maxLength !== undefined) {
    if (property.maxLength === undefined || property.maxLength > control.maxLength) {
      violations.push(issue(
        "binding.maxLength",
        `${property.label} must limit text to ${control.maxLength} characters or fewer.`,
        location,
      ));
    }
  }
  if (property.kind === "number" && control.kind === "number") {
    if (control.min !== undefined && (property.min === undefined || property.min < control.min)) {
      violations.push(issue("binding.minimum", `${property.label} must use a minimum of ${control.min} or greater.`, location));
    }
    if (control.max !== undefined && (property.max === undefined || property.max > control.max)) {
      violations.push(issue("binding.maximum", `${property.label} must use a maximum of ${control.max} or less.`, location));
    }
  }
  if (property.kind === "select" && control.kind === "select") {
    const supported = new Set(control.options.map((option) => option.value));
    if (property.options.some((option) => !supported.has(option.value))) {
      violations.push(issue("binding.options", `${property.label} includes an option that ${control.label} does not accept.`, location));
    }
  }
}

export function isValidRequiredControlValue(control: ComponentControl, value: unknown): boolean {
  if (isEmpty(value)) return false;
  const violations: StrictUiViolation[] = [];
  validateValue(control, value, { kind: "document" }, "property", violations);
  return violations.length === 0;
}

function validateControl(
  adapter: ComponentAdapter,
  node: DesignComponentNode,
  control: StrictControl,
  publicProperties: ReadonlyMap<string, ComponentPropertyDraft>,
  violations: StrictUiViolation[],
): void {
  const defaults = adapter.defaultProps as Readonly<Record<string, unknown>> | undefined;
  const fallback = node.props && Object.prototype.hasOwnProperty.call(node.props, control.prop)
    ? node.props[control.prop]
    : defaults?.[control.prop];
  const property = publicProperties.get(node.propertyBindings?.[control.prop] ?? "");
  const bindingMatches = property?.kind === control.kind;
  const effective = bindingMatches && property.defaultValue !== undefined
    ? property.defaultValue
    : fallback;
  const guaranteed = bindingMatches && property.required === true;
  const location: StrictUiLocation = { kind: "control", instanceId: node.instanceId, controlId: control.id };
  if (control.required && !guaranteed && isEmpty(effective)) {
    violations.push({
      ...issue("property.required", `${control.label} is required.`, location),
      suggestion: `Set ${control.label} before saving.`,
    });
    return;
  }
  if (effective === undefined || effective === null) return;
  validateValue(control, effective, location, "property", violations);
}

function validateValue(
  control: StrictControl | ComponentPropertyDraft,
  value: unknown,
  location: StrictUiLocation,
  prefix: string,
  violations: StrictUiViolation[],
): void {
  const valid = control.kind === "boolean"
    ? typeof value === "boolean"
    : control.kind === "number"
      ? typeof value === "number" && Number.isFinite(value)
      : control.kind === "select"
        ? typeof value === "string" || (typeof value === "number" && Number.isFinite(value))
        : typeof value === "string";
  if (!valid) {
    violations.push(issue(`${prefix}.type`, `${control.label} has the wrong value type.`, location));
    return;
  }
  if (control.kind === "text" && typeof value === "string" && control.maxLength !== undefined && value.length > control.maxLength) {
    violations.push(issue(`${prefix}.maxLength`, `${control.label} exceeds its maximum length.`, location));
  }
  if (control.kind === "number" && typeof value === "number") {
    if (control.min !== undefined && value < control.min) {
      violations.push(issue(`${prefix}.minimum`, `${control.label} is below its minimum.`, location));
    }
    if (control.max !== undefined && value > control.max) {
      violations.push(issue(`${prefix}.maximum`, `${control.label} exceeds its maximum.`, location));
    }
  }
  if (control.kind === "select" && !control.options.some((option) => option.value === value)) {
    violations.push(issue(`${prefix}.option`, `${control.label} uses an unavailable option.`, location));
  }
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

function defaultIssue(suffix: string, message: string, location: StrictUiLocation): StrictUiViolation {
  return issue(`definition.default.${suffix}`, message, location);
}

function issue(ruleId: string, message: string, location: StrictUiLocation): StrictUiViolation {
  return { ruleId, severity: "error", message, location };
}
