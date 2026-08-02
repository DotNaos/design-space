import type { DesignSpaceDevice } from "../../shared/source-workspace";

export type SourceViewportPreset = {
  id: string;
  label: string;
  compactLabel: string;
  device: DesignSpaceDevice | "responsive";
  width: number;
  height: number;
};

export const sourceViewportPresets: readonly SourceViewportPreset[] = [
  { id: "responsive", label: "Responsive", compactLabel: "Responsive", device: "responsive", width: 960, height: 900 },
  { id: "desktop-1440", label: "Desktop · 1440 × 900", compactLabel: "Desktop", device: "desktop", width: 1440, height: 900 },
  { id: "desktop-1280", label: "Desktop · 1280 × 800", compactLabel: "Desktop", device: "desktop", width: 1280, height: 800 },
  { id: "tablet-1024", label: "Tablet · 1024 × 1366", compactLabel: "Tablet", device: "tablet", width: 1024, height: 1366 },
  { id: "tablet-768", label: "Tablet · 768 × 1024", compactLabel: "Tablet", device: "tablet", width: 768, height: 1024 },
  { id: "mobile-430", label: "Mobile · 430 × 932", compactLabel: "Mobile", device: "mobile", width: 430, height: 932 },
  { id: "mobile-390", label: "Mobile · 390 × 844", compactLabel: "Mobile", device: "mobile", width: 390, height: 844 },
  { id: "mobile-375", label: "Mobile · 375 × 812", compactLabel: "Mobile", device: "mobile", width: 375, height: 812 },
];

export function defaultSourceViewport(device: DesignSpaceDevice): SourceViewportPreset {
  const preferred = device === "desktop" ? "desktop-1280" : device === "tablet" ? "tablet-768" : "mobile-390";
  return sourceViewportPresets.find((preset) => preset.id === preferred) ?? sourceViewportPresets[0];
}
