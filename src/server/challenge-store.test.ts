import { describe, expect, it } from "vitest";

import { ChallengeStore, MAXIMUM_LIVE_CHALLENGES } from "./challenge-store";

describe("ChallengeStore", () => {
  it("prunes expired challenges before enforcing the live-entry cap", () => {
    let now = 100;
    const store = new ChallengeStore<{ expiresAt: number; value: string }>({
      maximumLive: 2,
      now: () => now,
    });

    store.set("first", { expiresAt: 110, value: "one" });
    store.set("second", { expiresAt: 120, value: "two" });
    expect(() => store.set("third", { expiresAt: 130, value: "three" })).toThrowError(
      expect.objectContaining({ code: "VALIDATION_ERROR" }),
    );

    now = 110;
    store.set("third", { expiresAt: 130, value: "three" });
    expect(store.liveSize).toBe(2);
    expect(store.take("first")).toBeUndefined();
    expect(store.take("third")).toEqual({ expiresAt: 130, value: "three" });
  });

  it("lets the owner consume a requested expired challenge exactly once", () => {
    let now = 10;
    const store = new ChallengeStore<{ expiresAt: number }>({ now: () => now });
    store.set("requested", { expiresAt: 11 });
    store.set("abandoned", { expiresAt: 11 });

    now = 11;
    expect(store.has("requested")).toBe(true);
    expect(store.take("requested")).toEqual({ expiresAt: 11 });
    expect(store.take("requested")).toBeUndefined();
    expect(store.liveSize).toBe(0);
  });

  it("defaults to a maximum of 128 live challenges", () => {
    expect(MAXIMUM_LIVE_CHALLENGES).toBe(128);
    const store = new ChallengeStore<{ expiresAt: number }>({ now: () => 0 });
    for (let index = 0; index < MAXIMUM_LIVE_CHALLENGES; index += 1) {
      store.set(`challenge-${index}`, { expiresAt: 1 });
    }
    expect(store.liveSize).toBe(MAXIMUM_LIVE_CHALLENGES);
    expect(() => store.set("overflow", { expiresAt: 1 })).toThrowError(
      expect.objectContaining({ code: "VALIDATION_ERROR" }),
    );
  });

  it("removes a superseded challenge only when it belongs to the expected owner", () => {
    const store = new ChallengeStore<{ expiresAt: number; owner: string }>({ now: () => 0 });
    store.set("challenge", { expiresAt: 10, owner: "app" });

    expect(store.remove("challenge", (value) => value.owner === "library")).toBe(false);
    expect(store.has("challenge")).toBe(true);
    expect(store.remove("challenge", (value) => value.owner === "app")).toBe(true);
    expect(store.has("challenge")).toBe(false);
  });
});
