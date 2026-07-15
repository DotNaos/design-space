import type { SelectionTarget } from "../model";

export type SlotState = {
  id: string;
  selectionId: string;
  label: string;
  count: number;
  childLabel?: string;
  min?: number;
  max?: number;
  accepts?: readonly string[];
  acceptedLabels?: readonly string[];
  acceptsText?: boolean;
};

export type Selection = SelectionTarget;

export type SaveState = "saved" | "draft" | "preparing" | "ready" | "saving" | "stale" | "error";
