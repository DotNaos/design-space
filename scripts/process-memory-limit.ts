import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type ProcessMemoryEntry = {
  pid: number;
  ppid: number;
  rssKb: number;
};

export function parseProcessMemoryTable(output: string): ProcessMemoryEntry[] {
  return output
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length >= 3)
    .map(([pid, ppid, rssKb]) => ({
      pid: Number(pid),
      ppid: Number(ppid),
      rssKb: Number(rssKb),
    }))
    .filter(
      (entry) =>
        Number.isFinite(entry.pid) &&
        Number.isFinite(entry.ppid) &&
        Number.isFinite(entry.rssKb),
    );
}

export function processTreeRssKb(
  rootPid: number,
  entries: readonly ProcessMemoryEntry[],
): number {
  const children = new Map<number, ProcessMemoryEntry[]>();
  for (const entry of entries) {
    const siblings = children.get(entry.ppid) ?? [];
    siblings.push(entry);
    children.set(entry.ppid, siblings);
  }

  let total = 0;
  const pending = [rootPid];
  const visited = new Set<number>();
  while (pending.length > 0) {
    const pid = pending.pop();
    if (pid === undefined || visited.has(pid)) continue;
    visited.add(pid);

    const entry = entries.find((candidate) => candidate.pid === pid);
    if (entry) total += entry.rssKb;
    for (const child of children.get(pid) ?? []) pending.push(child.pid);
  }
  return total;
}

export async function readProcessTreeRssKb(rootPid: number): Promise<number> {
  const { stdout } = await execFileAsync(
    "ps",
    ["-axo", "pid=,ppid=,rss="],
    { maxBuffer: 10 * 1024 * 1024 },
  );
  return processTreeRssKb(rootPid, parseProcessMemoryTable(stdout));
}
