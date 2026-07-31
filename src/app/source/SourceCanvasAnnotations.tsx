import { Button, TextArea } from "@heroui/react";
import { Check, Trash2, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import type {
  SourceCanvasAnnotation,
  SourceCanvasAnnotationTarget,
  SourceFeedbackContext,
} from "./source-feedback";

export function sourceCanvasAnnotationTargetAtPoint(options: {
  context: SourceFeedbackContext;
  element: string;
  event: { clientX: number; clientY: number };
  occurrence: number;
  surface: HTMLElement;
}): SourceCanvasAnnotationTarget {
  const bounds = options.surface.getBoundingClientRect();
  const x = bounds.width > 0 ? (options.event.clientX - bounds.left) / bounds.width : 0.5;
  const y = bounds.height > 0 ? (options.event.clientY - bounds.top) / bounds.height : 0.5;
  return {
    context: options.context,
    element: options.element,
    occurrence: options.occurrence,
    point: {
      x: Math.max(0.02, Math.min(0.98, x)),
      y: Math.max(0.02, Math.min(0.98, y)),
    },
  };
}

export function useSourceCanvasAnnotations(scopeKey?: string) {
  const [active, setActiveState] = useState(false);
  const [annotations, setAnnotations] = useState<readonly SourceCanvasAnnotation[]>([]);
  const [target, setTarget] = useState<SourceCanvasAnnotationTarget>();
  const previousScope = useRef(scopeKey);

  useEffect(() => {
    if (previousScope.current === scopeKey) return;
    previousScope.current = scopeKey;
    setActiveState(false);
    setAnnotations([]);
    setTarget(undefined);
  }, [scopeKey]);

  const setActive = (next: boolean) => {
    setActiveState(next);
    if (!next) setTarget(undefined);
  };
  const edit = (annotation: SourceCanvasAnnotation) => {
    setActiveState(true);
    setTarget({
      annotationId: annotation.id,
      comment: annotation.comment,
      context: annotation.context,
      element: annotation.element,
      occurrence: annotation.occurrence,
      point: annotation.point,
    });
  };
  const save = (target: SourceCanvasAnnotationTarget, comment: string) => {
    const trimmed = comment.trim();
    if (!trimmed) return;
    const next: SourceCanvasAnnotation = {
      comment: trimmed,
      context: target.context,
      element: target.element,
      id: target.annotationId ?? globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      occurrence: target.occurrence,
      point: target.point,
    };
    setAnnotations((current) => target.annotationId
      ? current.map((annotation) => annotation.id === target.annotationId ? next : annotation)
      : [...current, next]);
    setTarget(undefined);
  };
  const remove = (id: string) => {
    setAnnotations((current) => current.filter((annotation) => annotation.id !== id));
    setTarget((current) => current?.annotationId === id ? undefined : current);
  };
  const clear = () => {
    setAnnotations([]);
    setTarget(undefined);
  };

  return {
    active,
    annotations,
    begin: setTarget,
    cancel: () => setTarget(undefined),
    clear,
    edit,
    remove,
    save,
    setActive,
    target,
  };
}

export function SourceCanvasAnnotationOverlay(props: {
  active: boolean;
  annotations: readonly SourceCanvasAnnotation[];
  target?: SourceCanvasAnnotationTarget;
  onCancel: () => void;
  onDelete: (id: string) => void;
  onEdit: (annotation: SourceCanvasAnnotation) => void;
  onFinish: () => void;
  onSave: (target: SourceCanvasAnnotationTarget, comment: string) => void;
}) {
  const [comment, setComment] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setComment(props.target?.comment ?? "");
    if (props.target) globalThis.setTimeout(() => inputRef.current?.focus(), 0);
  }, [props.target]);

  return (
    <div className="pointer-events-none absolute inset-0 z-20" data-testid="source-canvas-annotations">
      {props.active ? (
        <div className="pointer-events-auto absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-[#121212]/95 py-1 pl-3 pr-1 text-[11px] font-medium text-zinc-100 shadow-2xl backdrop-blur-xl">
          <span>Select an element to comment</span>
          <Button
            className="h-7 rounded-full bg-white/[0.08] px-2.5 text-[10px] text-zinc-100 hover:bg-white/[0.12]"
            size="sm"
            variant="secondary"
            onPress={(event) => activateWithKeyboard(event, props.onFinish)}
            onPointerUp={(event) => activateWithPointer(event, props.onFinish)}
          >
            Done
          </Button>
        </div>
      ) : null}

      {props.annotations.map((annotation, index) => (
        <Button
          key={annotation.id}
          isIconOnly
          aria-label={`Edit annotation ${index + 1} for ${annotation.element}`}
          className="pointer-events-auto absolute size-6 min-w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-zinc-950 bg-amber-300 p-0 text-[10px] font-bold tabular-nums text-zinc-950 shadow-lg shadow-black/40 outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-amber-200"
          size="sm"
          style={{ left: `${annotation.point.x * 100}%`, top: `${annotation.point.y * 100}%` }}
          variant="ghost"
          onPress={(event) => activateWithKeyboard(event, () => props.onEdit(annotation))}
          onPointerUp={(event) => activateWithPointer(event, () => props.onEdit(annotation))}
        >
          {index + 1}
        </Button>
      ))}

      {props.target ? (
        <form
          aria-label={`Annotation for ${props.target.element}`}
          className="pointer-events-auto absolute z-10 grid w-[min(320px,calc(100%_-_24px))] gap-2.5 rounded-2xl border border-white/15 bg-[#121212]/98 p-3 text-zinc-100 shadow-2xl shadow-black/50 backdrop-blur-xl"
          style={editorPosition(props.target.point)}
          onSubmit={(event) => {
            event.preventDefault();
            props.onSave(props.target!, comment);
          }}
        >
          <div className="flex min-w-0 items-center gap-2">
            <strong className="min-w-0 flex-1 truncate text-xs font-semibold">{props.target.element}</strong>
            <span className="shrink-0 text-[9px] text-zinc-500">{props.target.context.source.relativePath}</span>
          </div>
          <TextArea
            ref={inputRef}
            aria-label="Annotation comment"
            className="max-h-32 min-h-20 resize-none rounded-xl border-0 bg-zinc-800 px-3 py-2 text-xs leading-5 text-zinc-100 outline-none placeholder:text-zinc-500"
            placeholder="What should change?"
            rows={3}
            value={comment}
            variant="secondary"
            onChange={(event) => setComment(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                props.onCancel();
              }
            }}
          />
          <div className="flex items-center justify-end gap-1.5">
            {props.target.annotationId ? (
              <Button
                isIconOnly
                aria-label="Delete annotation"
                className="mr-auto size-8 min-w-8 rounded-full text-rose-300 hover:bg-rose-400/10"
                size="sm"
                variant="ghost"
                onPress={(event) => activateWithKeyboard(event, () => props.onDelete(props.target!.annotationId!))}
                onPointerUp={(event) => activateWithPointer(event, () => props.onDelete(props.target!.annotationId!))}
              >
                <Trash2 aria-hidden="true" size={13} />
              </Button>
            ) : null}
            <Button
              className="h-8 min-w-0 gap-1.5 rounded-full px-3 text-[10px] text-zinc-300 hover:bg-white/[0.07]"
              size="sm"
              variant="ghost"
              onPress={(event) => activateWithKeyboard(event, props.onCancel)}
              onPointerUp={(event) => activateWithPointer(event, props.onCancel)}
            >
              <X aria-hidden="true" size={12} />
              Cancel
            </Button>
            <Button
              className="h-8 min-w-0 gap-1.5 rounded-full bg-amber-300 px-3 text-[10px] font-semibold text-zinc-950 hover:bg-amber-200"
              isDisabled={!comment.trim()}
              size="sm"
              variant="primary"
              onPress={(event) => activateWithKeyboard(event, () => props.onSave(props.target!, comment))}
              onPointerUp={(event) => activateWithPointer(event, () => props.onSave(props.target!, comment))}
            >
              <Check aria-hidden="true" size={12} />
              {props.target.annotationId ? "Save" : "Add"}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function activateWithPointer(event: ReactPointerEvent<HTMLButtonElement>, action: () => void) {
  event.preventDefault();
  event.stopPropagation();
  action();
}

function activateWithKeyboard(event: { pointerType: string }, action: () => void) {
  if (event.pointerType === "keyboard" || event.pointerType === "virtual") action();
}

function editorPosition(point: SourceCanvasAnnotationTarget["point"]): CSSProperties {
  const horizontal = point.x > 0.62
    ? { right: "12px" }
    : { left: "12px" };
  const vertical = point.y > 0.58
    ? { bottom: `${Math.max(0, 1 - point.y) * 100 + 2}%` }
    : { top: `${point.y * 100 + 2}%` };
  return { ...horizontal, ...vertical };
}
