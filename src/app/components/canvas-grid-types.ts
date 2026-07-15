export type CanvasGridMode = "dots" | "lines";
export type CanvasLayoutGridSize = 4 | 8;

export type CanvasLayoutGridSettings = {
  color: string;
  enabled: boolean;
  size: CanvasLayoutGridSize;
};

export const defaultCanvasLayoutGrid: CanvasLayoutGridSettings = {
  color: "#22D3EE",
  enabled: false,
  size: 8,
};
