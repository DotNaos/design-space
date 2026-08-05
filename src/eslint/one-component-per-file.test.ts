import typescriptParser from "@typescript-eslint/parser";
import { Linter } from "eslint";
import { expect, it } from "vitest";

// @ts-expect-error The repository-owned ESLint rule is intentionally runtime JavaScript.
import designSpace from "../../eslint-rules/one-component-per-file.mjs";

function verify(code: string) {
  const linter = new Linter({ configType: "flat" });
  return linter.verify(code, [{
    files: ["**/*.tsx"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: "module" },
    },
    plugins: { "design-space": designSpace },
    rules: { "design-space/one-component-per-file": "error" },
  }], { filename: "Component.tsx" });
}

it("allows one component and non-component helpers", () => {
  expect(verify(`
    function label() { return "Button"; }
    export function Button() { return <button>{label()}</button>; }
  `)).toEqual([]);
  expect(verify(`export default function Button() { return <button />; }`)).toEqual([]);
});

it("rejects a second function or arrow component", () => {
  const messages = verify(`
    export function Button() { return <button />; }
    const Icon = () => <svg />;
  `);

  expect(messages).toHaveLength(1);
  expect(messages[0]).toMatchObject({ messageId: "multiple", line: 3 });
});

it("rejects components declared inside another component", () => {
  const messages = verify(`
    export function Menu() {
      const Item = () => <li />;
      return <ul><Item /></ul>;
    }
  `);

  expect(messages).toHaveLength(1);
  expect(messages[0]).toMatchObject({ messageId: "nested", line: 3 });
});

it("recognizes memo, forwardRef, default lambdas, and class components", () => {
  const wrapped = verify(`
    const Field = forwardRef((props, ref) => <input ref={ref} />);
    const MemoField = memo(() => <Field />);
  `);
  const defaultLambda = verify(`
    const Field = () => <input />;
    export default () => <Field />;
  `);
  const classComponent = verify(`
    class Field extends React.Component { render() { return <input />; } }
    function Label() { return <label />; }
  `);

  expect(wrapped).toHaveLength(1);
  expect(defaultLambda).toHaveLength(1);
  expect(classComponent).toHaveLength(1);
});

it("recognizes components behind nested wrappers", () => {
  const messages = verify(`
    const Button = memo(forwardRef(function Button(props, ref) {
      return <button ref={ref} {...props} />;
    }));
    const Icon = () => <svg />;
  `);

  expect(messages).toHaveLength(1);
  expect(messages[0]).toMatchObject({ messageId: "multiple", line: 5 });
});
