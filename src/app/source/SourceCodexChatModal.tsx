import { Button, Input, Modal, TextArea } from "@heroui/react";
import { ArrowUp, LoaderCircle, Plus, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  addSourceFeedbackAnnotation,
  formatSourceFeedback,
  type SourceFeedbackContext,
} from "./source-feedback";
import {
  readSourceCodexConversation,
  sendSourceCodexFeedback,
  type SourceCodexMessage,
  type SourceCodexOrigin,
  uploadSourceCodexImage,
} from "./source-codex-feedback-client";
import { SourceCodexMessageContent } from "./SourceCodexMessageContent";

const supportedScreenshotTypes = new Set(["image/gif", "image/jpeg", "image/png", "image/webp"]);
const maximumScreenshotBytes = 8 * 1024 * 1024;
const maximumScreenshots = 4;

type PendingScreenshot = {
  dataUrl: string;
  fileName: string;
  id: string;
  mediaType: string;
};

export function SourceCodexChatModal(props: {
  context?: SourceFeedbackContext;
  open: boolean;
  origin?: SourceCodexOrigin;
  onChooseTask?: () => void;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<SourceCodexMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [screenshots, setScreenshots] = useState<PendingScreenshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState<string>();
  const endRef = useRef<HTMLDivElement>(null);
  const loadInFlightRef = useRef(false);
  const pendingMessagesRef = useRef<SourceCodexMessage[]>([]);
  const sessionImageUrlsRef = useRef(new Map<string, readonly string[]>());
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);

  const loadConversation = useCallback(async (showLoading = false) => {
    if (!props.origin || loadInFlightRef.current) return;
    loadInFlightRef.current = true;
    if (showLoading) setLoading(true);
    try {
      const persisted = await readSourceCodexConversation(props.origin.threadId);
      const persistedUserMessages = new Set(
        persisted
          .filter((message) => message.role === "user")
          .map((message) => sourceCodexMessageIdentity(message.text)),
      );
      pendingMessagesRef.current = pendingMessagesRef.current.filter(
        (message) => !persistedUserMessages.has(sourceCodexMessageIdentity(message.text)),
      );
      setPendingCount(pendingMessagesRef.current.length);
      setMessages([
        ...persisted.map((message) => ({
          ...message,
          imageUrls: message.role === "user"
            ? sessionImageUrlsRef.current.get(sourceCodexMessageIdentity(message.text))
            : undefined,
        })),
        ...pendingMessagesRef.current,
      ]);
      setError(undefined);
    } catch (cause: unknown) {
      if (showLoading) {
        setError(messageFrom(cause, "The Codex conversation could not be loaded."));
      }
    } finally {
      loadInFlightRef.current = false;
      if (showLoading) setLoading(false);
    }
  }, [props.origin?.threadId]);

  useEffect(() => {
    pendingMessagesRef.current = [];
    sessionImageUrlsRef.current.clear();
    setPendingCount(0);
    setMessages([]);
    setScreenshots([]);
    setDragActive(false);
    dragDepthRef.current = 0;
    if (!props.open || !props.origin) return;
    void loadConversation(true);
    const refresh = window.setInterval(() => void loadConversation(), 2_500);
    return () => window.clearInterval(refresh);
  }, [loadConversation, props.open, props.origin?.threadId]);

  useEffect(() => {
    if (!props.open) return;
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, props.open]);

  async function send() {
    if (!props.origin || (!draft.trim() && !screenshots.length) || sending) return;
    const rawMessage = draft.trim() || "Screenshot attached.";
    const outgoing = formatSourceFeedback(rawMessage, props.context);
    const selectedScreenshots = screenshots;
    setSending(true);
    setError(undefined);
    setDraft("");
    setScreenshots([]);
    try {
      const uploads = await Promise.all(selectedScreenshots.map((screenshot) => uploadSourceCodexImage({
        dataUrl: screenshot.dataUrl,
        fileName: screenshot.fileName,
        mediaType: screenshot.mediaType,
      })));
      const optimistic: SourceCodexMessage = {
        imageUrls: selectedScreenshots.map((screenshot) => screenshot.dataUrl),
        role: "user",
        text: outgoing,
      };
      pendingMessagesRef.current = [...pendingMessagesRef.current, optimistic];
      sessionImageUrlsRef.current.set(sourceCodexMessageIdentity(outgoing), optimistic.imageUrls ?? []);
      setPendingCount(pendingMessagesRef.current.length);
      setMessages((current) => [...current, optimistic]);
      await sendSourceCodexFeedback(props.origin, outgoing, uploads.map((upload) => upload.path));
      if (props.context) addSourceFeedbackAnnotation(rawMessage, props.context);
    } catch (cause: unknown) {
      const outgoingIdentity = sourceCodexMessageIdentity(outgoing);
      pendingMessagesRef.current = pendingMessagesRef.current.filter(
        (message) => sourceCodexMessageIdentity(message.text) !== outgoingIdentity,
      );
      sessionImageUrlsRef.current.delete(outgoingIdentity);
      setPendingCount(pendingMessagesRef.current.length);
      setMessages((current) => {
        const reverseIndex = [...current].reverse().findIndex(
          (message) => message.role === "user" && message.text === outgoing,
        );
        if (reverseIndex < 0) return current;
        const outgoingIndex = current.length - reverseIndex - 1;
        return [...current.slice(0, outgoingIndex), ...current.slice(outgoingIndex + 1)];
      });
      setError(messageFrom(cause, "The message could not be sent."));
      setDraft(rawMessage);
      setScreenshots(selectedScreenshots);
    } finally {
      setSending(false);
    }
  }

  async function addScreenshots(files: FileList | readonly File[]) {
    const available = maximumScreenshots - screenshots.length;
    if (available <= 0) {
      setError("A message can include up to 4 screenshots.");
      return;
    }
    const selected = Array.from(files).slice(0, available);
    const invalid = selected.find((file) => !supportedScreenshotTypes.has(file.type));
    if (invalid) {
      setError("Only PNG, JPEG, WebP, and GIF screenshots are supported.");
      return;
    }
    const oversized = selected.find((file) => file.size > maximumScreenshotBytes);
    if (oversized) {
      setError("Screenshots must be smaller than 8 MB.");
      return;
    }
    const additions = await Promise.all(selected.map(async (file): Promise<PendingScreenshot> => ({
      dataUrl: await readFileAsDataUrl(file),
      fileName: file.name || "screenshot",
      id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      mediaType: file.type,
    })));
    setScreenshots((current) => [...current, ...additions]);
    setError(undefined);
  }

  return (
    <Modal.Backdrop
      isOpen={props.open}
      onOpenChange={(open) => {
        if (!open && !sending) props.onClose();
      }}
      variant="blur"
    >
      <Modal.Container className="p-3 sm:p-5" placement="center" size="cover">
        <Modal.Dialog
          aria-label="Codex conversation"
          className="flex h-[min(900px,92dvh)] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#141518] text-zinc-200 shadow-2xl"
        >
          <Modal.Header className="shrink-0 border-b border-white/10 px-4 py-3">
            <div className="flex w-full items-center gap-3">
              <div className="min-w-0 flex-1">
                <Modal.Heading className="truncate text-sm font-semibold text-zinc-100">
                  {props.origin?.title ?? "Codex conversation"}
                </Modal.Heading>
                <p className="mt-0.5 truncate text-[10px] text-zinc-500">
                  {props.origin?.repositoryLabel ?? props.origin?.cwd ?? "Local Codex task"}
                  {props.origin && !props.origin.writable ? " · reconnect to write" : ""}
                </p>
              </div>
              <Button
                isIconOnly
                aria-label="Refresh Codex conversation"
                className="size-9 min-w-9 text-zinc-500"
                isDisabled={!props.origin || loading}
                size="sm"
                variant="ghost"
                onPress={() => void loadConversation(true)}
              >
                <RefreshCw aria-hidden="true" className={loading ? "animate-spin" : ""} size={15} />
              </Button>
              <Button
                isIconOnly
                aria-label="Close Codex conversation"
                className="size-9 min-w-9"
                isDisabled={sending}
                size="sm"
                variant="ghost"
                onPress={props.onClose}
              >
                <X aria-hidden="true" size={16} />
              </Button>
            </div>
          </Modal.Header>

          <Modal.Body className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
              {loading && !messages.length ? (
                <div className="grid min-h-64 place-items-center text-zinc-600">
                  <LoaderCircle aria-hidden="true" className="animate-spin" size={20} />
                </div>
              ) : messages.length ? (
                messages.map((message, index) => (
                  <article
                    key={`${message.role}-${index}`}
                    className={message.role === "user"
                      ? "ml-auto max-w-[82%] rounded-xl border border-sky-400/10 bg-sky-500/[0.09] px-4 py-3 text-zinc-200"
                      : "max-w-3xl text-zinc-300"}
                  >
                    {message.imageUrls?.length ? (
                      <div className="mb-3 grid max-w-xl grid-cols-2 gap-2 last:mb-0">
                        {message.imageUrls.map((imageUrl, imageIndex) => (
                          <a
                            key={`${imageUrl.slice(0, 32)}-${imageIndex}`}
                            className="group relative overflow-hidden rounded-lg border border-white/10 bg-black/20"
                            href={imageUrl}
                            rel="noreferrer"
                            target="_blank"
                          >
                            <img
                              alt={`Screenshot ${imageIndex + 1}`}
                              className="max-h-72 w-full object-contain transition-opacity group-hover:opacity-90"
                              src={imageUrl}
                            />
                          </a>
                        ))}
                      </div>
                    ) : null}
                    <div className="text-[12px] leading-6">
                      <SourceCodexMessageContent text={message.text} />
                    </div>
                  </article>
                ))
              ) : (
                <div className="grid min-h-64 place-items-center text-center">
                  <div>
                    <p className="text-sm font-medium text-zinc-300">No recent messages</p>
                    <p className="mt-1 text-xs text-zinc-600">Send the first message from this Design Space.</p>
                  </div>
                </div>
              )}
              {pendingCount > 0 ? (
                <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                  <LoaderCircle aria-hidden="true" className="animate-spin" size={12} />
                  Codex is working…
                </div>
              ) : null}
              <div ref={endRef} />
            </div>
          </Modal.Body>

          {error ? (
            <p role="alert" className="shrink-0 border-t border-red-400/15 bg-red-500/8 px-5 py-2 text-[10px] text-red-300">
              {error}
            </p>
          ) : null}

          <Modal.Footer className="shrink-0 border-t border-white/10 p-3 sm:px-6 sm:py-4">
            <div className="mx-auto w-full max-w-4xl">
              {props.origin && !props.origin.writable ? (
                <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-amber-300/15 bg-amber-300/[0.04] px-3 py-2">
                  <p className="text-[10px] leading-4 text-amber-100/70">
                    Reconnect this task before sending another message. Existing Codex Desktop tasks are writable once connected.
                  </p>
                  {props.onChooseTask ? (
                    <Button className="h-8 shrink-0 px-3 text-[10px]" variant="secondary" onPress={props.onChooseTask}>
                      Reconnect task
                    </Button>
                  ) : null}
                </div>
              ) : null}
              <div
                aria-label="Codex message composer"
                className={`relative flex min-h-12 w-full flex-wrap items-end gap-1 rounded-[1.75rem] border p-1.5 shadow-[0_18px_58px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-[border-color,background-color,box-shadow] ${
                  dragActive
                    ? "border-sky-300/50 bg-sky-400/[0.08] shadow-[0_18px_58px_rgba(0,0,0,0.28),0_0_0_3px_rgba(56,189,248,0.08)]"
                    : "border-white/10 bg-[#0d0e10]/95 focus-within:border-white/20"
                }`}
                role="group"
                onDragEnter={(event) => {
                  if (!event.dataTransfer.types.includes("Files")) return;
                  event.preventDefault();
                  dragDepthRef.current += 1;
                  setDragActive(true);
                }}
                onDragLeave={(event) => {
                  if (!event.dataTransfer.types.includes("Files")) return;
                  dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
                  if (!dragDepthRef.current) setDragActive(false);
                }}
                onDragOver={(event) => {
                  if (event.dataTransfer.types.includes("Files")) event.preventDefault();
                }}
                onDrop={(event) => {
                  dragDepthRef.current = 0;
                  setDragActive(false);
                  if (!event.dataTransfer.files.length) return;
                  event.preventDefault();
                  void addScreenshots(event.dataTransfer.files);
                }}
              >
                {screenshots.length ? (
                  <div className="flex w-full min-w-0 gap-2 overflow-x-auto px-2 pb-1 pt-1" aria-label="Attached screenshots">
                    {screenshots.map((screenshot) => (
                      <div
                        key={screenshot.id}
                        className="group relative size-14 shrink-0"
                      >
                        <img
                          alt={screenshot.fileName}
                          className="size-full rounded-xl border border-white/10 object-cover"
                          src={screenshot.dataUrl}
                        />
                        <Button
                          isIconOnly
                          aria-label={`Remove ${screenshot.fileName}`}
                          className="absolute -right-1 -top-1 size-5 min-w-5 rounded-full bg-zinc-950 text-white shadow-md"
                          size="sm"
                          variant="ghost"
                          onPress={() => setScreenshots((current) => current.filter((item) => item.id !== screenshot.id))}
                        >
                          <X aria-hidden="true" size={10} />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <Input
                  ref={screenshotInputRef}
                  multiple
                  aria-label="Choose screenshots"
                  className="sr-only"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => {
                    if (event.target.files?.length) void addScreenshots(event.target.files);
                    event.target.value = "";
                  }}
                />
                <Button
                  isIconOnly
                  aria-label="Attach screenshots"
                  className="size-9 min-w-9 rounded-full text-zinc-400 hover:bg-white/[0.07] hover:text-zinc-100"
                  isDisabled={!props.origin || !props.origin.writable || sending || screenshots.length >= maximumScreenshots}
                  size="sm"
                  variant="ghost"
                  onPress={() => screenshotInputRef.current?.click()}
                >
                  <Plus aria-hidden="true" size={17} />
                </Button>
                <TextArea
                  aria-label="Message Codex"
                  className="max-h-24 min-h-9 min-w-0 flex-1 resize-none border-0 bg-transparent px-3 py-1.5 text-sm leading-6 text-zinc-100 shadow-none outline-none placeholder:text-zinc-500"
                  disabled={!props.origin || !props.origin.writable || sending}
                  placeholder={props.context ? `Comment on ${props.context.label}…` : "Message Codex…"}
                  rows={1}
                  title="Enter to send · Shift+Enter for a new line"
                  value={draft}
                  variant="secondary"
                  onChange={(event) => setDraft(event.target.value)}
                  onPaste={(event) => {
                    const images = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"));
                    if (!images.length) return;
                    event.preventDefault();
                    void addScreenshots(images);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                />
                <Button
                  isIconOnly
                  aria-label="Send message to Codex"
                  className="size-9 min-w-9 rounded-full bg-zinc-100 text-zinc-950 shadow-sm hover:bg-white"
                  isDisabled={!props.origin || !props.origin.writable || sending || (!draft.trim() && !screenshots.length)}
                  isPending={sending}
                  size="sm"
                  onPress={() => void send()}
                >
                  <ArrowUp aria-hidden="true" size={16} />
                </Button>
              </div>
            </div>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

export function sourceCodexMessageIdentity(text: string): string {
  return text
    .replace(/<\/?image\b[^>]*>/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function messageFrom(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name || "the screenshot"}.`));
    reader.onload = () => typeof reader.result === "string"
      ? resolve(reader.result)
      : reject(new Error(`Could not read ${file.name || "the screenshot"}.`));
    reader.readAsDataURL(file);
  });
}
