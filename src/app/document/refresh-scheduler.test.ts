import { describe, expect, it } from "vitest";

import { createRefreshScheduler } from "./refresh-scheduler";

describe("refresh scheduler", () => {
  it("serializes a queued run before earlier subscribers can request another", async () => {
    const runs = [deferred(), deferred(), deferred()];
    let started = 0;
    let running = 0;
    let maximumRunning = 0;
    const scheduler = createRefreshScheduler(() => {
      const run = runs[started++];
      running += 1;
      maximumRunning = Math.max(maximumRunning, running);
      return run.promise.finally(() => { running -= 1; });
    });

    const first = scheduler.request();
    const earlyFollower = first.then(() => scheduler.request());
    const queued = scheduler.request();
    runs[0].resolve();
    await nextTask();

    expect(started).toBe(2);
    expect(maximumRunning).toBe(1);
    const duringTrailing = scheduler.request();
    expect(scheduler.request()).toBe(duringTrailing);

    runs[1].resolve();
    await nextTask();
    expect(started).toBe(3);
    expect(maximumRunning).toBe(1);

    runs[2].resolve();
    await Promise.all([first, queued, earlyFollower, duringTrailing]);
    expect(maximumRunning).toBe(1);
  });

  it("drops queued work when its owner is disposed", async () => {
    const run = deferred();
    let started = 0;
    const scheduler = createRefreshScheduler(() => {
      started += 1;
      return run.promise;
    });

    const active = scheduler.request();
    const queued = scheduler.request();
    scheduler.dispose();
    await queued;
    run.resolve();
    await active;
    await nextTask();

    expect(started).toBe(1);
    await scheduler.request();
    expect(started).toBe(1);

    scheduler.activate();
    await scheduler.request();
    expect(started).toBe(2);
  });

  it("observes an ignored queued failure and accepts a later request", async () => {
    const runs = [deferred(), deferred(), deferred()];
    let started = 0;
    const scheduler = createRefreshScheduler(() => runs[started++].promise);

    const active = scheduler.request();
    void scheduler.request();
    runs[0].resolve();
    await active;
    await nextTask();

    runs[1].reject(new Error("Trailing refresh failed."));
    await nextTask();
    const recovered = scheduler.request();
    expect(started).toBe(3);
    runs[2].resolve();
    await recovered;
  });
});

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, reject, resolve };
}

function nextTask(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}
