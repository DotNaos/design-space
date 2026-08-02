import { Button, Input, Tooltip } from "@heroui/react";
import { ArrowUp, MessageSquare, MessageSquarePlus } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { SourceCodexChatModal } from "./SourceCodexChatModal";
import { SourceCodexConnectionIndicator } from "./SourceCodexConnectionIndicator";
import { SourceCodexConnectionModal } from "./SourceCodexConnectionModal";
import {
  addSourceFeedbackAnnotation,
  formatSourceFeedback,
  type SourceCanvasAnnotation,
  type SourceFeedbackContext,
  useSourceFeedbackAnnotations,
} from "./source-feedback";
import {
  inspectSourceCodexOrigin,
  requestedSourceCodexThreadId,
  sendSourceCodexFeedback,
  SourceCodexTaskUnavailableError,
  type SourceCodexOrigin,
} from "./source-codex-feedback-client";

export function SourceCanvasFeedbackDock(props: {
  annotationMode?: boolean;
  annotations?: readonly SourceCanvasAnnotation[];
  context?: SourceFeedbackContext;
  meta?: ReactNode;
  onAnnotationModeChange?: (active: boolean) => void;
  onAnnotationsSent?: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [origin, setOrigin] = useState<SourceCodexOrigin>();
  const [preferredThreadId, setPreferredThreadId] = useState(requestedSourceCodexThreadId);
  const [connection, setConnection] = useState<"checking" | "disconnected" | "ready">("checking");
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [conversationOpen, setConversationOpen] = useState(false);
  const [connectionNotice, setConnectionNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);
  const comments = useSourceFeedbackAnnotations(props.context?.id);
  const annotations = props.annotations ?? [];

  useEffect(() => {
    let active = true;
    void inspectSourceCodexOrigin()
      .then((next) => {
        if (!active) return;
        setOrigin(next);
        setConnection(next ? "ready" : "disconnected");
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setConnection("disconnected");
        if (cause instanceof SourceCodexTaskUnavailableError) {
          setPreferredThreadId(cause.threadId ?? requestedSourceCodexThreadId());
          setConnectionNotice(cause.message);
          setConnectionOpen(true);
          return;
        }
        setError(cause instanceof Error ? cause.message : "The Codex task is not reachable.");
      });
    return () => { active = false; };
  }, []);

  async function send() {
    if (!origin || (!draft.trim() && !annotations.length) || sending) return;
    setSending(true);
    setError(undefined);
    try {
      await sendSourceCodexFeedback(origin, formatSourceFeedback(draft, props.context, annotations));
      if (props.context && draft.trim()) addSourceFeedbackAnnotation(draft, props.context);
      for (const annotation of annotations) {
        addSourceFeedbackAnnotation(annotation.comment, annotation.context);
      }
      setDraft("");
      props.onAnnotationsSent?.();
    } catch (cause: unknown) {
      if (cause instanceof SourceCodexTaskUnavailableError) {
        setOrigin(undefined);
        setPreferredThreadId(cause.threadId ?? origin.threadId);
        setConnection("disconnected");
        setConnectionNotice(cause.message);
        setConnectionOpen(true);
      } else {
        setError(cause instanceof Error ? cause.message : "Feedback could not be sent.");
      }
    } finally {
      setSending(false);
    }
  }

  const connected = connection === "ready" && Boolean(origin);
  const writable = connected && Boolean(origin?.writable);
  const placeholder = connection === "checking"
    ? "Connecting to Codex…"
      : writable
      ? props.context
        ? annotations.length
          ? `Add a message or send ${annotations.length} annotation${annotations.length === 1 ? "" : "s"}…`
          : `Comment on ${props.context.label}…`
        : "Message the working Codex task…"
      : connected
        ? "Reconnect this Codex task to send…"
      : "Choose a Codex task to connect…";

  return (
    <>
      <div
        className="mx-auto flex w-full max-w-[min(560px,100%)] flex-col overflow-visible rounded-2xl bg-[#101114]/96 shadow-[0_14px_38px_rgba(0,0,0,0.32)] backdrop-blur-xl"
        data-testid="source-canvas-feedback-dock"
      >
        <div className={`flex h-7 min-w-0 items-center gap-1 border-b border-white/[0.06] px-1.5 ${props.meta ? "justify-between" : "justify-end"}`} data-testid="source-codex-session-stack">
          {props.meta ? <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">{props.meta}</div> : null}
          <SourceCodexConnectionIndicator
            connection={connection}
            origin={origin}
            onPress={() => setConnectionOpen(true)}
          />
        </div>
        <div className="grid h-11 min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] items-center px-1 sm:grid-cols-[2.5rem_minmax(0,1fr)_2.5rem]">
          <Tooltip closeDelay={80} delay={350}>
            <Button
              isIconOnly
              aria-label={props.annotationMode
                ? `Finish adding canvas annotations, ${annotations.length} saved`
                : annotations.length
                  ? `Continue adding canvas annotations, ${annotations.length} saved`
                  : "Add a canvas annotation"}
              aria-pressed={props.annotationMode}
              className={`relative size-8 min-w-8 shrink-0 rounded-lg ${
                props.annotationMode || annotations.length
                  ? "bg-amber-300 text-zinc-950 hover:bg-amber-200"
                  : "text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-100"
              }`}
              isDisabled={!writable || !props.context || !props.onAnnotationModeChange}
              size="sm"
              variant="ghost"
              onPress={() => props.onAnnotationModeChange?.(!props.annotationMode)}
            >
              <MessageSquarePlus aria-hidden="true" size={15} />
              {annotations.length ? (
                  <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full border-2 border-[#101114] bg-amber-200 px-1 text-[8px] font-bold leading-3 text-zinc-950">
                  {annotations.length}
                </span>
              ) : null}
            </Button>
            <Tooltip.Content className="rounded-lg bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">
              {props.annotationMode ? "Finish placing annotations" : "Comment on a precise canvas element"}
            </Tooltip.Content>
          </Tooltip>
          <div
            aria-label="Codex composer"
            aria-disabled={!connected}
            className={`relative flex h-9 w-full min-w-0 items-center gap-0.5 rounded-lg bg-black/15 px-0.5 transition-colors sm:min-w-64 ${
              writable
                ? "focus-within:bg-black/25"
                : connected
                  ? "bg-amber-300/[0.03]"
                  : "opacity-65"
            }`}
          >
            {error ? (
              <div
                role="alert"
                className="absolute bottom-full right-0 mb-2 max-w-[min(420px,calc(100vw-2rem))] rounded-md border border-red-400/25 bg-[#26171a] px-2 py-1 text-[9px] leading-4 text-red-200 shadow-xl"
              >
                {error}
              </div>
            ) : null}
            <Tooltip closeDelay={80} delay={350}>
              <Button
                isIconOnly
                aria-label="Open full Codex conversation"
                className="relative size-7 min-w-7 shrink-0 rounded-md text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-100"
                isDisabled={!connected}
                size="sm"
                variant="ghost"
                onPress={() => setConversationOpen(true)}
              >
                <MessageSquare aria-hidden="true" size={14} />
                {comments.length ? (
                  <span className="absolute right-1 top-1 size-1.5 rounded-full bg-violet-400 ring-2 ring-[#0d0e10]" />
                ) : null}
              </Button>
              <Tooltip.Content className="rounded-lg bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">
                Open full conversation · {comments.length} saved comment{comments.length === 1 ? "" : "s"}
              </Tooltip.Content>
            </Tooltip>
            <Input
              aria-label="Codex feedback"
              className="min-w-0 flex-1 bg-transparent px-1.5 text-[11px] text-zinc-100 outline-none placeholder:text-zinc-500"
              placeholder={placeholder}
              disabled={!writable || sending}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
            />
            <Tooltip closeDelay={80} delay={350}>
              <Button
                isIconOnly
                aria-label="Send to Codex"
                className="size-7 min-w-7 rounded-md bg-zinc-100 text-zinc-950 hover:bg-white"
                isDisabled={!writable || (!draft.trim() && !annotations.length)}
                isPending={sending}
                size="sm"
                variant="ghost"
                onPress={() => void send()}
              >
                <ArrowUp aria-hidden="true" size={14} />
              </Button>
              <Tooltip.Content className="rounded-lg bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">
                {writable ? `Send to ${origin?.title}` : "Reconnect a Codex task to send"}
              </Tooltip.Content>
            </Tooltip>
          </div>
          <span aria-hidden="true" className="hidden size-8 sm:block" />
        </div>
      </div>
      <SourceCodexConnectionModal
        current={origin}
        preferredThreadId={preferredThreadId}
        notice={connectionNotice}
        open={connectionOpen}
        onClose={() => {
          setConnectionOpen(false);
          setConnectionNotice(undefined);
        }}
        onConnected={(task) => {
          setOrigin(task);
          setPreferredThreadId(task.threadId);
          setConnection("ready");
          setConnectionNotice(undefined);
          setError(undefined);
        }}
      />
      <SourceCodexChatModal
        context={props.context}
        open={conversationOpen}
        origin={origin}
        onChooseTask={() => {
          setConversationOpen(false);
          setConnectionOpen(true);
        }}
        onClose={() => setConversationOpen(false)}
      />
    </>
  );
}
