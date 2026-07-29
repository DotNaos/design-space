import { describe, expect, it } from "vitest";

import { measureSourcePreviewContent } from "./source-preview-content-size";

describe("measureSourcePreviewContent", () => {
  it("measures visible content instead of a full-screen wrapper", () => {
    const output = document.createElement("div");
    const wrapper = sourceLayer(output, rect(0, 0, 1280, 800));
    sourceLayer(wrapper, rect(100, 50, 500, 220));
    mockRect(output, rect(0, 0, 1280, 800));

    expect(measureSourcePreviewContent(output)).toEqual({ width: 400, height: 170 });
  });

  it("falls back to the source layer when it is the only measurable content", () => {
    const output = document.createElement("div");
    sourceLayer(output, rect(0, 0, 1280, 800));
    mockRect(output, rect(0, 0, 1280, 800));

    expect(measureSourcePreviewContent(output)).toEqual({ width: 1280, height: 800 });
  });

  it("returns no size before source content is rendered", () => {
    const output = document.createElement("div");
    mockRect(output, rect(0, 0, 1280, 800));

    expect(measureSourcePreviewContent(output)).toBeUndefined();
  });
});

function sourceLayer(parent: HTMLElement, bounds: DOMRect): HTMLElement {
  const element = document.createElement("div");
  element.dataset.designSpaceSourceLayerId = crypto.randomUUID();
  mockRect(element, bounds);
  parent.append(element);
  return element;
}

function mockRect(element: HTMLElement, bounds: DOMRect): void {
  element.getBoundingClientRect = () => bounds;
}

function rect(left: number, top: number, right: number, bottom: number): DOMRect {
  return {
    bottom,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}
