import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import type { RuntimeSourceWorkspace } from "../../shared/source-workspace";
import { useSourceWorkspaceFiles } from "./useSourceWorkspaceFiles";

const runLocalOperation = vi.hoisted(() => vi.fn());

vi.mock("../api", () => ({ runLocalOperation }));

afterEach(() => vi.clearAllMocks());

it("loads the attached library catalog without replacing the app catalog", async () => {
  const appFiles = [{ id: "app.file", label: "App.tsx", kind: "file" as const }];
  const libraryFiles = [{ id: "library.file", label: "Button.tsx", kind: "file" as const, editable: true }];
  runLocalOperation.mockResolvedValue({ files: libraryFiles });

  const developmentWorkspace = {} as RuntimeSourceWorkspace;
  const { result, rerender } = renderHook(
    ({ scope }) => useSourceWorkspaceFiles(scope, appFiles, developmentWorkspace),
    { initialProps: { scope: "app" as "app" | "library-development" } },
  );

  expect(result.current).toBe(appFiles);
  expect(runLocalOperation).not.toHaveBeenCalled();

  rerender({ scope: "library-development" });
  await waitFor(() => expect(result.current).toEqual(libraryFiles));
  expect(runLocalOperation).toHaveBeenCalledWith({
    type: "list-project-files",
    scope: "library-development",
  });

  rerender({ scope: "app" });
  expect(result.current).toBe(appFiles);
});
