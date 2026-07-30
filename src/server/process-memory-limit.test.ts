import { describe, expect, it } from "vitest";

import {
  parseProcessMemoryTable,
  processTreeRssKb,
} from "../../scripts/process-memory-limit";

describe("process memory limit", () => {
  it("parses the macOS ps process table", () => {
    expect(
      parseProcessMemoryTable(`
        10     1    512
        11    10   1024
      `),
    ).toEqual([
      { pid: 10, ppid: 1, rssKb: 512 },
      { pid: 11, ppid: 10, rssKb: 1024 },
    ]);
  });

  it("adds only the selected process tree", () => {
    const entries = parseProcessMemoryTable(`
      10 1 100
      11 10 200
      12 11 300
      20 1 900
    `);

    expect(processTreeRssKb(10, entries)).toBe(600);
    expect(processTreeRssKb(20, entries)).toBe(900);
  });
});
