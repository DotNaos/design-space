import type { TailwindIntelligence } from "../shared/contracts";
import { DesignSpaceError } from "./errors";

interface AnalysisJob {
  value: string;
  cursor: number;
  settled: boolean;
  resolve: (result: TailwindIntelligence) => void;
  reject: (error: unknown) => void;
}

export function tailwindDisposedError(): DesignSpaceError {
  return new DesignSpaceError("VALIDATION_ERROR", "Tailwind IntelliSense has been shut down");
}

function supersededError(): DesignSpaceError {
  return new DesignSpaceError("VALIDATION_ERROR", "Tailwind IntelliSense was superseded by a newer request");
}

/** Runs one analysis and retains at most the newest request waiting behind it. */
export class TailwindAnalysisQueue {
  readonly #run: (value: string, cursor: number) => Promise<TailwindIntelligence>;
  #activeJob?: AnalysisJob;
  #queuedJob?: AnalysisJob;
  #disposed = false;

  constructor(run: (value: string, cursor: number) => Promise<TailwindIntelligence>) {
    this.#run = run;
  }

  analyze(value: string, cursor: number): Promise<TailwindIntelligence> {
    if (this.#disposed) return Promise.reject(tailwindDisposedError());
    return new Promise((resolve, reject) => {
      const job: AnalysisJob = { value, cursor, settled: false, resolve, reject };
      if (!this.#activeJob) {
        this.#activeJob = job;
        void this.#runJob(job);
        return;
      }
      if (this.#queuedJob) this.#rejectJob(this.#queuedJob, supersededError());
      this.#queuedJob = job;
    });
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    if (this.#activeJob) this.#rejectJob(this.#activeJob, tailwindDisposedError());
    if (this.#queuedJob) this.#rejectJob(this.#queuedJob, tailwindDisposedError());
    this.#activeJob = undefined;
    this.#queuedJob = undefined;
  }

  async #runJob(job: AnalysisJob): Promise<void> {
    try {
      const result = await this.#run(job.value, job.cursor);
      if (this.#disposed) this.#rejectJob(job, tailwindDisposedError());
      else this.#resolveJob(job, result);
    } catch (error) {
      this.#rejectJob(job, error);
    } finally {
      if (this.#activeJob === job) this.#activeJob = undefined;
      if (this.#disposed || this.#activeJob) return;
      const next = this.#queuedJob;
      this.#queuedJob = undefined;
      if (next) {
        this.#activeJob = next;
        void this.#runJob(next);
      }
    }
  }

  #resolveJob(job: AnalysisJob, result: TailwindIntelligence): void {
    if (job.settled) return;
    job.settled = true;
    job.resolve(result);
  }

  #rejectJob(job: AnalysisJob, error: unknown): void {
    if (job.settled) return;
    job.settled = true;
    job.reject(error);
  }
}
