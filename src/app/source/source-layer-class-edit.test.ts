import { expect, it } from "vitest";

import { sourceWithLayerClassName, sourceWithLayerText, sourceWithLayerVisualState } from "./source-layer-class-edit";

it("replaces a static JSX className with an exact expression literal", () => {
  const source = 'export const Panel = () => <section className="p-4">Panel</section>;';
  const start = source.indexOf("className");
  const end = start + 'className="p-4"'.length;
  expect(sourceWithLayerClassName(source, { value: "p-4", start, end, syntax: "attribute" }, "p-6 rounded-xl")).toBe(
    'export const Panel = () => <section className="p-6 rounded-xl">Panel</section>;',
  );
});

it("escapes special characters while preserving JSX attribute syntax", () => {
  const source = 'const value = <div className="p-4" />;';
  const start = source.indexOf("className");
  const end = start + 'className="p-4"'.length;
  expect(sourceWithLayerClassName(source, { value: "p-4", start, end, syntax: "attribute" }, 'before:content-["<"]')).toBe(
    'const value = <div className="before:content-[&quot;&lt;&quot;]" />;',
  );
});

it("adds a missing className without changing an empty draft", () => {
  const source = "export const Panel = () => <section>Panel</section>;";
  const offset = source.indexOf("section") + "section".length;
  const binding = { value: "", start: offset, end: offset, insert: true as const };
  expect(sourceWithLayerClassName(source, binding, "")).toBe(source);
  expect(sourceWithLayerClassName(source, binding, "grid gap-4")).toBe(
    'export const Panel = () => <section className={"grid gap-4"}>Panel</section>;',
  );
});

it("replaces static JSX text while escaping source-significant characters", () => {
  const source = "export const Badge = () => <span>Ready</span>;";
  const start = source.indexOf("Ready");
  expect(sourceWithLayerText(source, {
    value: "Ready",
    start,
    end: start + "Ready".length,
    syntax: "text",
  }, "Ready & {safe}")).toBe(
    "export const Badge = () => <span>Ready &amp; &#123;safe&#125;</span>;",
  );
});

it("preserves an authored JSX string expression", () => {
  const source = 'export const Badge = () => <span>{"Ready"}</span>;';
  const start = source.indexOf('{"Ready"}');
  expect(sourceWithLayerText(source, {
    value: "Ready",
    start,
    end: start + '{"Ready"}'.length,
    syntax: "expression",
  }, 'Needs "review"')).toBe(
    'export const Badge = () => <span>{"Needs \\"review\\""}</span>;',
  );
});

it("applies class and text changes from the same source snapshot without shifting bindings", () => {
  const source = 'export const Badge = () => <span className="px-2">Ready</span>;';
  const classStart = source.indexOf("className");
  const textStart = source.indexOf("Ready");
  expect(sourceWithLayerVisualState(source, {
    className: {
      binding: { value: "px-2", start: classStart, end: classStart + 'className="px-2"'.length, syntax: "attribute" },
      value: "rounded-full px-4",
    },
    text: {
      binding: { value: "Ready", start: textStart, end: textStart + "Ready".length, syntax: "text" },
      value: "Approved",
    },
  })).toBe('export const Badge = () => <span className="rounded-full px-4">Approved</span>;');
});

it("refuses stale visual bindings instead of editing unrelated source", () => {
  const original = 'export const Panel = () => <section className="p-4">Ready</section>;';
  const shifted = `// Monaco changed the offsets\n${original}`;
  const classStart = original.indexOf("className");
  const textStart = original.indexOf("Ready");

  expect(sourceWithLayerVisualState(shifted, {
    className: {
      binding: { value: "p-4", start: classStart, end: classStart + 'className="p-4"'.length, syntax: "attribute" },
      value: "p-6",
    },
    text: {
      binding: { value: "Ready", start: textStart, end: textStart + "Ready".length, syntax: "text" },
      value: "Approved",
    },
  })).toBe(shifted);
});

it("refuses a stale className range after the attribute was edited in code", () => {
  const original = 'export function Status() { return <div className="sr-only">Status</div>; }';
  const edited = original.replace('className="sr-only"', 'className="sr-only rounded-none pl-4"');
  const start = original.indexOf("className");
  const binding = {
    value: "sr-only",
    start,
    end: start + 'className="sr-only"'.length,
    syntax: "attribute" as const,
  };

  expect(sourceWithLayerClassName(edited, binding, "sr-only rounded-none pl-[0px]")).toBe(edited);
});
