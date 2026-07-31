import { Button, Input, Tooltip } from "@heroui/react";
import { ArrowUp, Cable, MessageSquare, Unplug } from "lucide-react";
import { useEffect, useState } from "react";

import { SourceCodexChatModal } from "./SourceCodexChatModal";
import { SourceCodexConnectionModal } from "./SourceCodexConnectionModal";
import {
  addSourceFeedbackAnnotation,
  formatSourceFeedback,
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
  context?: SourceFeedbackContext;
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
    if (!origin || !draft.trim() || sending) return;
    setSending(true);
    setError(undefined);
    try {
      await sendSourceCodexFeedback(origin, formatSourceFeedback(draft, props.context));
      if (props.context) addSourceFeedbackAnnotation(draft, props.context);
      setDraft("");
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
        ? `Comment on ${props.context.label}…`
        : "Message the working Codex task…"
      : connected
        ? "Reconnect this Codex task to send…"
      : "Choose a Codex task to connect…";

  return (
    <>
      <div
        aria-label="Codex composer"
        className={`relative flex h-10 min-w-64 max-w-[min(460px,calc(100vw-2rem))] flex-1 items-center gap-0.5 rounded-full border bg-[#0d0e10]/95 p-1 shadow-[0_18px_58px_rgba(0,0,0,0.32)] backdrop-blur-xl transition-colors ${
          writable ? "border-white/10 focus-within:border-white/20" : "border-amber-300/15"
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
            className="relative size-8 min-w-8 shrink-0 rounded-full text-zinc-400 hover:bg-white/[0.07] hover:text-zinc-100"
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
          <Tooltip.Content className="rounded-md border border-white/10 bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">
            Open full conversation · {comments.length} saved comment{comments.length === 1 ? "" : "s"}
          </Tooltip.Content>
        </Tooltip>
        <Input
          aria-label="Codex feedback"
          className={`min-w-0 flex-1 bg-transparent px-2 text-xs text-zinc-100 outline-none placeholder:text-zinc-500 ${
            writable ? "" : "cursor-pointer"
          }`}
          placeholder={placeholder}
          readOnly={!writable}
          disabled={sending}
          value={draft}
          onClick={() => {
            if (!writable && connection !== "checking") setConnectionOpen(true);
          }}
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
            aria-label={connected ? "Change connected Codex task" : "Connect Codex task"}
            className={`size-8 min-w-8 shrink-0 rounded-full ${
              writable ? "text-zinc-500 hover:bg-white/[0.07] hover:text-zinc-200" : "text-amber-300/70 hover:bg-amber-300/10"
            }`}
            isDisabled={connection === "checking"}
            size="sm"
            variant="ghost"
            onPress={() => setConnectionOpen(true)}
          >
            {writable ? <Cable aria-hidden="true" size={12} /> : <Unplug aria-hidden="true" size={12} />}
          </Button>
          <Tooltip.Content className="max-w-64 rounded-md border border-white/10 bg-[#202126] px-2 py-1 text-[10px] leading-4 text-zinc-200 shadow-xl">
            {writable
              ? `Connected to ${origin?.title}. Click to change task.`
              : connected
                ? `${origin?.title} needs to be reconnected before sending messages.`
                : "Choose an existing Codex task or create a new one."}
          </Tooltip.Content>
        </Tooltip>
        <Tooltip closeDelay={80} delay={350}>
          <Button
            isIconOnly
            aria-label="Send to Codex"
            className="size-8 min-w-8 rounded-full bg-zinc-100 text-zinc-950 shadow-sm hover:bg-white"
            isDisabled={!writable || !draft.trim()}
            isPending={sending}
            size="sm"
            variant="ghost"
            onPress={() => void send()}
          >
            <ArrowUp aria-hidden="true" size={14} />
          </Button>
          <Tooltip.Content className="rounded-md border border-white/10 bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">
            {writable ? `Send to ${origin?.title}` : "Reconnect a Codex task to send"}
          </Tooltip.Content>
        </Tooltip>
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
