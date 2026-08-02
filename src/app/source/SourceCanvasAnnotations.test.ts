import { expect, it } from "vitest";

import { sourceCanvasAnnotationEditorPosition } from "./SourceCanvasAnnotations";

it("anchors the annotation editor immediately beside a centered canvas point", () => {
  expect(sourceCanvasAnnotationEditorPosition({ x: 0.5, y: 0.5 })).toEqual({
    left: "50%",
    top: "50%",
    transform: "translateX(-50%) translateY(12px)",
  });
});

it("keeps annotation editors beside canvas edges", () => {
  expect(sourceCanvasAnnotationEditorPosition({ x: 0.1, y: 0.1 })).toEqual({
    left: "10%",
    top: "10%",
    transform: "translateX(12px) translateY(12px)",
  });
  expect(sourceCanvasAnnotationEditorPosition({ x: 0.9, y: 0.9 })).toEqual({
    left: "90%",
    top: "90%",
    transform: "translateX(calc(-100% - 12px)) translateY(calc(-100% - 12px))",
  });
});
