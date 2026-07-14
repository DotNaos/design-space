import { describe, expect, it } from "vitest";

import { canonicalJson } from "./canonical-json";

describe("canonical JSON", () => {
  it("sorts every object while preserving array order", () => {
    expect(canonicalJson({ z: 1, nested: { beta: true, alpha: [2, 1] }, a: "first" })).toBe(
      '{"a":"first","nested":{"alpha":[2,1],"beta":true},"z":1}',
    );
  });

  it("rejects values that cannot be represented deterministically", () => {
    expect(() => canonicalJson({ missing: undefined })).toThrow("only JSON values");
    expect(() => canonicalJson({ value: Number.NaN })).toThrow("finite numbers");
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => canonicalJson(circular)).toThrow("circular values");
  });
});
