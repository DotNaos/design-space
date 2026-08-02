import { expect, it } from "vitest";

import { monacoModelPath } from "./monaco-model-path";

it("keeps the real language extension at the end of unique Monaco model paths", () => {
  expect(monacoModelPath("src/app/App.tsx", ":r3:"))
    .toBe("/src/app/App.design-space-r3.tsx");
  expect(monacoModelPath("/src/theme.css", ":r4:"))
    .toBe("/src/theme.design-space-r4.css");
});
