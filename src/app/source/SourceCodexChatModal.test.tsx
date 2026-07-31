import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sourceCodexMessageIdentity, SourceCodexChatModal } from "./SourceCodexChatModal";
import type { SourceCodexMessage, SourceCodexOrigin } from "./source-codex-feedback-client";

const { readSourceCodexConversation, sendSourceCodexFeedback, uploadSourceCodexImage } = vi.hoisted(() => ({
  readSourceCodexConversation: vi.fn<() => Promise<SourceCodexMessage[]>>(async () => []),
  sendSourceCodexFeedback: vi.fn(async () => undefined),
  uploadSourceCodexImage: vi.fn(async () => ({ path: "/tmp/design-space-codex-attachments/test.png" })),
}));

vi.mock("./source-codex-feedback-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./source-codex-feedback-client")>();
  return {
    ...actual,
    readSourceCodexConversation,
    sendSourceCodexFeedback,
    uploadSourceCodexImage,
  };
});

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  readSourceCodexConversation.mockClear();
  readSourceCodexConversation.mockResolvedValue([]);
  sendSourceCodexFeedback.mockClear();
  uploadSourceCodexImage.mockClear();
});

const origin: SourceCodexOrigin = {
  cwd: "/Users/oli/projects/design-space",
  repositoryLabel: "design-space",
  status: "active",
  threadId: "019f651f-2bca-7513-9be5-857cb5fb86e6",
  title: "#10 · Ares · Fix Codex chat picker",
  writable: true,
};

describe("SourceCodexChatModal", () => {
  it("matches persisted screenshot messages with their optimistic version", () => {
    expect(sourceCodexMessageIdentity(`Please inspect this screenshot
<image name=[Image #1] path="/tmp/selection.png">
</image>`)).toBe("Please inspect this screenshot");
  });

  it("replaces an optimistic screenshot message with the persisted message instead of duplicating it", async () => {
    let resolveConversation: ((messages: SourceCodexMessage[]) => void) | undefined;
    readSourceCodexConversation.mockImplementationOnce(() => new Promise((resolve) => {
      resolveConversation = resolve;
    }));

    const user = userEvent.setup();
    render(<SourceCodexChatModal open origin={origin} onClose={() => undefined} />);
    const screenshot = new File([new Uint8Array([137, 80, 78, 71])], "selection.png", {
      lastModified: 1,
      type: "image/png",
    });
    await user.upload(await screen.findByLabelText("Choose screenshots"), screenshot);
    await user.type(screen.getByRole("textbox", { name: "Message Codex" }), "Only once");
    await user.click(screen.getByRole("button", { name: "Send message to Codex" }));
    expect(await screen.findAllByText("Only once")).toHaveLength(1);

    resolveConversation?.([{ role: "user", text: "Only once" }]);
    await waitFor(() => expect(readSourceCodexConversation).toHaveBeenCalledOnce());
    expect(screen.getAllByText("Only once")).toHaveLength(1);
  });

  it("lets an existing connected Codex Desktop task receive messages", async () => {
    render(
      <SourceCodexChatModal
        open
        origin={origin}
        onClose={() => undefined}
      />,
    );

    const composer = await screen.findByRole("textbox", { name: "Message Codex" });
    expect(composer).toBeEnabled();
    expect(screen.queryByText(/must use a task created by Design Space/i)).not.toBeInTheDocument();

    await userEvent.type(composer, "Roundtrip from Design Space");
    await userEvent.click(screen.getByRole("button", { name: "Send message to Codex" }));

    expect(sendSourceCodexFeedback).toHaveBeenCalledWith(origin, "Roundtrip from Design Space", []);
  });

  it("renders Codex replies as structured Markdown", async () => {
    readSourceCodexConversation.mockResolvedValueOnce([{
      role: "assistant",
      text: "## Result\n\n- First item\n- Second item with `code` and [a link](https://example.com)",
    }]);

    render(<SourceCodexChatModal open origin={origin} onClose={() => undefined} />);

    expect(await screen.findByRole("heading", { name: "Result" })).toBeVisible();
    expect(screen.getByRole("list")).toBeVisible();
    expect(screen.getByText("code").tagName).toBe("CODE");
    expect(screen.getByRole("link", { name: "a link" })).toHaveAttribute("href", "https://example.com");
  });

  it("uploads screenshots and sends them as native Codex attachments", async () => {
    const user = userEvent.setup();
    render(<SourceCodexChatModal open origin={origin} onClose={() => undefined} />);

    const screenshot = new File([
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]),
    ], "selection.png", { type: "image/png", lastModified: 1 });
    await user.upload(await screen.findByLabelText("Choose screenshots"), screenshot);
    expect(await screen.findByRole("img", { name: "selection.png" })).toBeVisible();

    await user.type(screen.getByRole("textbox", { name: "Message Codex" }), "Please inspect this screenshot");
    await user.click(screen.getByRole("button", { name: "Send message to Codex" }));

    await waitFor(() => expect(uploadSourceCodexImage).toHaveBeenCalledWith(expect.objectContaining({
      dataUrl: expect.stringMatching(/^data:image\/png;base64,/),
      fileName: "selection.png",
      mediaType: "image/png",
    })));
    await waitFor(() => expect(sendSourceCodexFeedback).toHaveBeenCalledWith(
      origin,
      "Please inspect this screenshot",
      ["/tmp/design-space-codex-attachments/test.png"],
    ));
  });

  it("asks for a reconnect without claiming Desktop tasks are read-only", async () => {
    const onChooseTask = vi.fn();
    render(
      <SourceCodexChatModal
        open
        origin={{ ...origin, writable: false }}
        onChooseTask={onChooseTask}
        onClose={() => undefined}
      />,
    );

    expect(await screen.findByText(/Existing Codex Desktop tasks are writable once connected/i)).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Message Codex" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Reconnect task" }));
    expect(onChooseTask).toHaveBeenCalledOnce();
  });
});
