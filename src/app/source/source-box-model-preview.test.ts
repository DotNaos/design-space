import { afterEach, describe, expect, it, vi } from "vitest";

import { createSourceBoxModelPreviewStore, mountSourceBoxModelPreview } from "./source-box-model-preview";

afterEach(() => {
  document.body.replaceChildren();
});

describe("source box model preview", () => {
  it("publishes transient values without coupling them to source updates", () => {
    const store = createSourceBoxModelPreviewStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.set({ className: "p-6", kind: "padding" });

    expect(store.getSnapshot()).toEqual({ className: "p-6", kind: "padding" });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it.each([
    { className: "m-2", kind: "margin", property: "margin-top", value: "8px" },
    { className: "border-2", kind: "border", property: "border-top-width", value: "2px" },
    { className: "p-2", kind: "padding", property: "padding-top", value: "8px" },
  ] as const)("previews and restores $kind changes", ({ className, kind, property, value }) => {
    const target = document.createElement("div");
    target.style.setProperty(property, "3px");
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
      bottom: 60,
      height: 40,
      left: 10,
      right: 110,
      top: 20,
      width: 100,
      x: 10,
      y: 20,
      toJSON: () => undefined,
    });
    document.body.append(target);

    const cleanup = mountSourceBoxModelPreview(target, {
      className,
      kind,
    });

    expect(target.style.getPropertyValue(property)).toBe(value);
    expect(target.style.getPropertyPriority(property)).toBe("important");
    expect(document.querySelector(`[data-design-space-box-model-preview="${kind}"]`)).toHaveStyle({
      borderStyle: "solid",
    });

    cleanup();

    expect(target.style.getPropertyValue(property)).toBe("3px");
    expect(document.querySelector("[data-design-space-box-model-preview]")).not.toBeInTheDocument();
  });
});
