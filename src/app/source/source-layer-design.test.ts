import { describe, expect, it } from "vitest";

import {
  setSourceLayerDimension,
  setSourceLayerFill,
  setSourceLayerStroke,
  setSourceLayerStrokeWidth,
  sourceLayerPaint,
} from "./source-layer-design";

describe("source layer visual utilities", () => {
  it("edits only unmodified width and height utilities", () => {
    expect(setSourceLayerDimension("w-full md:w-1/2 h-auto", "width", 320)).toBe("w-[320px] md:w-1/2 h-auto");
    expect(setSourceLayerDimension("w-full h-auto", "height", 144.6)).toBe("w-full h-[145px]");
  });

  it("maps arbitrary fill and stroke values without touching variants", () => {
    expect(setSourceLayerFill("bg-white hover:bg-zinc-900", "#141518")).toBe("bg-[#141518] hover:bg-zinc-900");
    expect(setSourceLayerStroke("border border-white/10 dark:border-zinc-700", "#38bdf8")).toBe("border border-[#38bdf8] dark:border-zinc-700");
  });

  it("maps stroke widths and reads editable paint values", () => {
    const next = setSourceLayerStrokeWidth("border border-[#38bdf8] bg-[#141518]", 2);
    expect(next).toBe("border-[2px] border-[#38bdf8] bg-[#141518]");
    expect(sourceLayerPaint(next)).toEqual({ fill: "#141518", stroke: "#38bdf8", strokeWidth: 2 });
    expect(setSourceLayerStrokeWidth(next, 0)).toBe("border-[#38bdf8] bg-[#141518]");
  });
});
