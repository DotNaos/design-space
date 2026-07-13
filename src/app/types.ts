import type { SelectionTarget } from "../model";

export type SlotState = {
  id: string;
  selectionId: string;
  label: string;
  count: number;
  childLabel?: string;
};

export type Selection = SelectionTarget;

export type SaveState = "saved" | "draft" | "preparing" | "ready" | "saving" | "stale" | "error";
