import { randomBytes, randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { RunningDesignSpaceTarget } from "../shared/running-targets";

interface TargetLease extends Omit<RunningDesignSpaceTarget, "current"> {
  schemaVersion: 1;
  token: string;
  pid: number;
  updatedAt: number;
}

export interface RunningTargetRegistryOptions {
  directory?: string;
  fetch?: typeof fetch;
  heartbeatMs?: number;
  now?: () => number;
  ttlMs?: number;
}

export class RunningTargetRegistry {
  readonly instanceId = randomUUID();
  readonly token = randomBytes(32).toString("hex");
  private readonly directory: string;
  private readonly fetcher: typeof fetch;
  private readonly heartbeatMs: number;
  private readonly now: () => number;
  private readonly ttlMs: number;
  private interval?: ReturnType<typeof setInterval>;
  private lease?: TargetLease;

  constructor(
    private readonly project: { id: string; label: string },
    private readonly url: string | undefined,
    options: RunningTargetRegistryOptions = {},
  ) {
    this.directory = options.directory ?? join(tmpdir(), `design-space-${typeof process.getuid === "function" ? process.getuid() : "user"}`);
    this.fetcher = options.fetch ?? fetch;
    this.heartbeatMs = options.heartbeatMs ?? 2_000;
    this.now = options.now ?? Date.now;
    this.ttlMs = options.ttlMs ?? 8_000;
  }

  async start(): Promise<void> {
    if (!this.url || !isTrustedInstanceUrl(this.url)) return;
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    await chmod(this.directory, 0o700);
    this.lease = {
      schemaVersion: 1,
      instanceId: this.instanceId,
      token: this.token,
      pid: process.pid,
      project: this.project,
      url: new URL(this.url).origin,
      updatedAt: this.now(),
    };
    await this.writeLease();
    this.interval = setInterval(() => void this.writeLease(), this.heartbeatMs);
    this.interval.unref?.();
  }

  async stop(): Promise<void> {
    if (this.interval) clearInterval(this.interval);
    this.interval = undefined;
    await rm(this.leasePath(), { force: true }).catch(() => undefined);
  }

  acceptsHealthToken(token: string | undefined): boolean {
    return Boolean(this.lease && token && token === this.token);
  }

  healthPayload(): Omit<RunningDesignSpaceTarget, "current" | "url"> {
    return { instanceId: this.instanceId, project: this.project };
  }

  async verifiedTargets(): Promise<readonly RunningDesignSpaceTarget[]> {
    const leases = await this.readLeases();
    const verified = await Promise.all(leases.map((lease) => this.verifyLease(lease)));
    return verified.filter((target): target is RunningDesignSpaceTarget => Boolean(target))
      .sort((left, right) => Number(right.current) - Number(left.current) || left.project.label.localeCompare(right.project.label, "en"));
  }

  private async verifyLease(lease: TargetLease): Promise<RunningDesignSpaceTarget | undefined> {
    if (lease.instanceId === this.instanceId && this.lease) {
      return { instanceId: lease.instanceId, project: lease.project, url: lease.url, current: true };
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 750);
    try {
      const endpoint = new URL("/__design-space/health", lease.url);
      endpoint.searchParams.set("token", lease.token);
      const response = await this.fetcher(endpoint, { signal: controller.signal, headers: { accept: "application/json" } });
      if (!response.ok) return undefined;
      const value = await response.json() as { instanceId?: unknown; project?: { id?: unknown; label?: unknown } };
      if (value.instanceId !== lease.instanceId || value.project?.id !== lease.project.id || value.project?.label !== lease.project.label) return undefined;
      return { instanceId: lease.instanceId, project: lease.project, url: lease.url, current: false };
    } catch {
      return undefined;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async readLeases(): Promise<TargetLease[]> {
    const names = await readdir(this.directory).catch(() => [] as string[]);
    const leases: TargetLease[] = [];
    for (const name of names) {
      if (!name.endsWith(".json")) continue;
      const path = join(this.directory, name);
      const metadata = await lstat(path).catch(() => undefined);
      if (!metadata?.isFile() || metadata.isSymbolicLink()) continue;
      const value = await readFile(path, "utf8").then((source) => JSON.parse(source) as unknown).catch(() => undefined);
      if (!isLease(value) || this.now() - value.updatedAt > this.ttlMs || !isTrustedInstanceUrl(value.url)) continue;
      leases.push(value);
    }
    return leases;
  }

  private async writeLease(): Promise<void> {
    if (!this.lease) return;
    this.lease.updatedAt = this.now();
    const temporary = `${this.leasePath()}.${randomBytes(6).toString("hex")}.tmp`;
    await writeFile(temporary, JSON.stringify(this.lease), { mode: 0o600 });
    await chmod(temporary, 0o600);
    await rename(temporary, this.leasePath());
  }

  private leasePath(): string {
    return join(this.directory, `${this.instanceId}.json`);
  }
}

function isLease(value: unknown): value is TargetLease {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const lease = value as Partial<TargetLease>;
  return lease.schemaVersion === 1 && typeof lease.instanceId === "string" && typeof lease.token === "string"
    && typeof lease.pid === "number" && typeof lease.updatedAt === "number" && typeof lease.url === "string"
    && typeof lease.project?.id === "string" && typeof lease.project.label === "string";
}

export function isTrustedInstanceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:")
      && !url.username && !url.password && url.hostname.endsWith(".localhost")
      && (url.pathname === "/" || url.pathname === "") && !url.search && !url.hash;
  } catch {
    return false;
  }
}
