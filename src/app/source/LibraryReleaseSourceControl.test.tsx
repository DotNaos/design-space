import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { LibraryReleaseStatus } from "../../shared/source-workspace";
import { LibraryReleaseSourceControl } from "./LibraryReleaseSourceControl";

const runLocalOperation = vi.hoisted(() => vi.fn());

vi.mock("../api", () => ({ runLocalOperation }));

const releases: LibraryReleaseStatus = {
  packageName: "@dotnaos/react-ui",
  currentVersion: "0.0.5",
  requestedVersion: "^0.0.5",
  latestVersion: "0.0.6",
  versions: [
    { version: "0.0.6", publishedAt: "2026-03-01T00:00:00.000Z" },
    { version: "0.0.5", publishedAt: "2026-02-01T00:00:00.000Z" },
    { version: "0.0.4", publishedAt: "2026-01-01T00:00:00.000Z" },
  ],
};

beforeEach(() => {
  runLocalOperation.mockReset();
});

afterEach(cleanup);

it("loads published releases and installs the selected version", async () => {
  const onModeChange = vi.fn();
  runLocalOperation
    .mockResolvedValueOnce(releases)
    .mockResolvedValueOnce({ ...releases, currentVersion: "0.0.6", requestedVersion: "0.0.6" });

  render(
    <LibraryReleaseSourceControl
      active
      fallbackVersion="^0.0.5"
      onModeChange={onModeChange}
    />,
  );

  const trigger = screen.getByRole("button", { name: "Installed library version" });
  expect(trigger).toHaveTextContent("0.0.5");
  await waitFor(() => expect(runLocalOperation).toHaveBeenCalledWith({ type: "get-library-releases" }));
  await userEvent.click(trigger);
  expect(await screen.findByText("Published versions")).toBeVisible();
  await userEvent.click(await screen.findByRole("option", { name: /0\.0\.6/ }));

  await waitFor(() => expect(runLocalOperation).toHaveBeenLastCalledWith({
    type: "install-library-release",
    version: "0.0.6",
  }));
  expect(onModeChange).toHaveBeenCalledWith("release");
});

it("filters older releases without exposing arbitrary versions", async () => {
  runLocalOperation.mockResolvedValueOnce(releases);
  render(
    <LibraryReleaseSourceControl
      active={false}
      fallbackVersion="^0.0.5"
      onModeChange={vi.fn()}
    />,
  );

  await waitFor(() => expect(runLocalOperation).toHaveBeenCalledWith({ type: "get-library-releases" }));
  await userEvent.click(screen.getByRole("button", { name: "Installed library version" }));
  const search = await screen.findByRole("textbox", { name: "Search library versions" });
  await userEvent.type(search, "0.0.4");
  expect(screen.getByRole("option", { name: /0\.0\.4/ })).toBeVisible();
  expect(screen.queryByRole("option", { name: /0\.0\.6/ })).not.toBeInTheDocument();
});
