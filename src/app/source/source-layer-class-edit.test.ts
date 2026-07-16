import { expect, it } from "vitest";

import { sourceWithLayerClassName, sourceWithLayerText } from "./source-layer-class-edit";

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
