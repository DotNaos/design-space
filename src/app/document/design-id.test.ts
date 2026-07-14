import { afterEach, describe, expect, it, vi } from "vitest";

import { createDesignIdFactory, createPortableDraftId } from "./design-id";

describe("design identities", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("survives reload-like factory resets without reusing an existing persisted ID", () => {
    const existing = "draft-00000000-0000-4000-8000-000000000001";
    const values = [
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000003",
    ];
    const createId = createDesignIdFactory(
      { instanceId: "root", adapterId: "stack", slots: { content: [{ kind: "component", node: { instanceId: existing, adapterId: "text", slots: {} } }] } },
      () => values.shift()!,
    );

    expect(createId()).toBe("draft-00000000-0000-4000-8000-000000000002");
    expect(createId()).toBe("draft-00000000-0000-4000-8000-000000000003");
  });

  it("creates a UUID when randomUUID is unavailable on a plain tailnet HTTP origin", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.set(Array.from({ length: 16 }, (_, index) => index));
        return bytes;
      },
    });
    const createId = createDesignIdFactory({ instanceId: "root", adapterId: "stack", slots: { content: [] } });

    expect(createPortableDraftId()).toBe("draft-00010203-0405-4607-8809-0a0b0c0d0e0f");
    expect(createId()).toBe("draft-00010203-0405-4607-8809-0a0b0c0d0e0f");
  });
});
