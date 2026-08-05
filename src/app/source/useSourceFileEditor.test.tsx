import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { useSourceFileEditor } from "./useSourceFileEditor";

const runLocalOperation = vi.hoisted(() => vi.fn());

vi.mock("../api", () => ({ runLocalOperation }));

afterEach(() => vi.clearAllMocks());

it("keeps library file reads and edits inside the development scope", async () => {
  runLocalOperation
    .mockResolvedValueOnce({
      fileId: "library.button",
      label: "src/Button.tsx",
      source: "export const Button = 1;\n",
      version: "v1",
    })
    .mockResolvedValueOnce({
      challengeId: "challenge",
      fileId: "library.button",
      baseVersion: "v1",
      nextVersion: "v2",
      diff: "diff",
      expiresAt: new Date().toISOString(),
    });

  const { result } = renderHook(() => useSourceFileEditor("library.button", "library-development"));
  await waitFor(() => expect(result.current.snapshot?.fileId).toBe("library.button"));
  expect(runLocalOperation).toHaveBeenNthCalledWith(1, {
    type: "read-project-file",
    fileId: "library.button",
    scope: "library-development",
  });

  act(() => result.current.setDraft("export const Button = 2;\n"));
  await act(async () => { await result.current.prepare(); });
  expect(runLocalOperation).toHaveBeenNthCalledWith(2, {
    type: "prepare-project-file-edit",
    fileId: "library.button",
    baseVersion: "v1",
    source: "export const Button = 2;\n",
    scope: "library-development",
  });
});
