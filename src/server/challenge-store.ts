import { DesignSpaceError } from "./errors";

export const MAXIMUM_LIVE_CHALLENGES = 128;

interface ExpiringChallenge {
  expiresAt: number;
}

export interface ChallengeStoreOptions {
  maximumLive?: number;
  now?: () => number;
}

/** Bounded in-memory storage for one-time save challenges. */
export class ChallengeStore<Value extends ExpiringChallenge> {
  readonly #maximumLive: number;
  readonly #now: () => number;
  readonly #values = new Map<string, Value>();

  constructor(options: ChallengeStoreOptions = {}) {
    this.#maximumLive = options.maximumLive ?? MAXIMUM_LIVE_CHALLENGES;
    this.#now = options.now ?? Date.now;
    if (!Number.isSafeInteger(this.#maximumLive) || this.#maximumLive < 1) {
      throw new TypeError("Challenge capacity must be a positive integer");
    }
  }

  set(id: string, value: Value): void {
    this.pruneExpired();
    if (!this.#values.has(id) && this.#values.size >= this.#maximumLive) {
      throw new DesignSpaceError(
        "VALIDATION_ERROR",
        "Too many changes are waiting to be saved; save one or wait for an older change to expire",
      );
    }
    this.#values.set(id, value);
  }

  /**
   * Reports the requested entry even when it just expired so the owning service
   * can consume it and preserve its CHALLENGE_EXPIRED response.
   */
  has(id: string): boolean {
    const present = this.#values.has(id);
    this.#pruneExpiredExcept(present ? id : undefined);
    return present;
  }

  /** Removes and returns a one-time challenge, then clears other expired entries. */
  take(id: string): Value | undefined {
    const value = this.#values.get(id);
    this.#values.delete(id);
    this.pruneExpired();
    return value;
  }

  pruneExpired(): number {
    return this.#pruneExpiredExcept();
  }

  get liveSize(): number {
    this.pruneExpired();
    return this.#values.size;
  }

  #pruneExpiredExcept(preservedId?: string): number {
    const now = this.#now();
    let removed = 0;
    for (const [id, value] of this.#values) {
      if (id !== preservedId && value.expiresAt <= now) {
        this.#values.delete(id);
        removed += 1;
      }
    }
    return removed;
  }
}
