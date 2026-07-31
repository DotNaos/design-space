import { useSyncExternalStore } from "react";

import type {
  SourceWorkspaceEntry,
  SourceWorkspaceLayer,
} from "../../shared/source-workspace";

const storageKey = "design-space.source-feedback.v1";
const listeners = new Set<() => void>();
let cachedRaw = "";
let cachedAnnotations: readonly SourceFeedbackAnnotation[] = [];

export interface SourceFeedbackContext {
  id: string;
  kind: "component" | "layer" | "slot";
  label: string;
  source: {
    end: number;
    relativePath: string;
    start: number;
  };
}

export interface SourceFeedbackAnnotation {
  comment: string;
  context: SourceFeedbackContext;
  createdAt: string;
  id: string;
}

export interface SourceCanvasAnnotation {
  comment: string;
  context: SourceFeedbackContext;
  element: string;
  id: string;
  occurrence: number;
  point: {
    x: number;
    y: number;
  };
}

export type SourceCanvasAnnotationTarget = Omit<SourceCanvasAnnotation, "comment" | "id"> & {
  annotationId?: string;
  comment?: string;
};

export function sourceFeedbackContext(
  entry?: SourceWorkspaceEntry,
  layer?: SourceWorkspaceLayer,
): SourceFeedbackContext | undefined {
  if (!entry) return undefined;
  if (!layer) {
    return {
      id: `component:${entry.id}`,
      kind: "component",
      label: entry.label,
      source: {
        end: entry.source.end,
        relativePath: entry.relativePath,
        start: entry.source.start,
      },
    };
  }
  return {
    id: `${entry.id}:${layer.id}`,
    kind: layer.kind === "component" ? "component" : layer.kind === "slot" ? "slot" : "layer",
    label: layer.label,
    source: {
      end: layer.source.end,
      relativePath: entry.relativePath,
      start: layer.source.start,
    },
  };
}

export function formatSourceFeedback(
  message: string,
  context?: SourceFeedbackContext,
  annotations: readonly SourceCanvasAnnotation[] = [],
) {
  const trimmed = message.trim();
  if (annotations.length) {
    const lines = [
      ...(trimmed ? [trimmed, ""] : []),
      "---",
      "Design Space annotations",
      ...annotations.flatMap((annotation, index) => {
        const range = sourceRange(annotation.context);
        return [
          `${index + 1}. ${annotation.element} — ${annotation.comment}`,
          `   Source: ${annotation.context.source.relativePath}:${range}`,
          `   Canvas point: ${Math.round(annotation.point.x * 100)}% × ${Math.round(annotation.point.y * 100)}%`,
          ...(annotation.occurrence > 0 ? [`   Rendered instance: ${annotation.occurrence + 1}`] : []),
        ];
      }),
    ];
    return lines.join("\n");
  }
  if (!context) return trimmed;
  return [
    trimmed,
    "",
    "---",
    "Design Space context",
    `- ${context.kind}: ${context.label}`,
    `- Source: ${context.source.relativePath}:${sourceRange(context)}`,
  ].join("\n");
}

function sourceRange(context: SourceFeedbackContext) {
  return context.source.start === context.source.end
    ? `${context.source.start}`
    : `${context.source.start}-${context.source.end}`;
}

export function addSourceFeedbackAnnotation(
  comment: string,
  context: SourceFeedbackContext,
) {
  const next = [
    {
      comment: comment.trim(),
      context,
      createdAt: new Date().toISOString(),
      id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    },
    ...readAnnotations(),
  ].slice(0, 100);
  writeAnnotations(next);
}

export function useSourceFeedbackAnnotations(contextId?: string) {
  const annotations = useSyncExternalStore(subscribe, readAnnotations, () => cachedAnnotations);
  return contextId
    ? annotations.filter((annotation) => annotation.context.id === contextId)
    : annotations;
}

function readAnnotations(): readonly SourceFeedbackAnnotation[] {
  if (typeof window === "undefined") return cachedAnnotations;
  const raw = window.localStorage.getItem(storageKey) ?? "";
  if (raw === cachedRaw) return cachedAnnotations;
  cachedRaw = raw;
  try {
    const parsed = JSON.parse(raw || "[]");
    cachedAnnotations = Array.isArray(parsed) ? parsed : [];
  } catch {
    cachedAnnotations = [];
  }
  return cachedAnnotations;
}

function writeAnnotations(annotations: readonly SourceFeedbackAnnotation[]) {
  cachedAnnotations = annotations;
  cachedRaw = JSON.stringify(annotations);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(storageKey, cachedRaw);
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
