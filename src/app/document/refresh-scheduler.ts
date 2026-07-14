export interface RefreshScheduler {
  activate: () => void;
  dispose: () => void;
  request: () => Promise<void>;
}

interface PendingRefresh {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
}

export function createRefreshScheduler(run: () => Promise<void>): RefreshScheduler {
  let active: Promise<void> | undefined;
  let trailing: PendingRefresh | undefined;
  let disposed = false;

  const launch = (): Promise<void> => {
    const request = run();
    active = request;

    const finish = () => {
      if (active !== request) return;
      if (disposed) {
        active = undefined;
        return;
      }

      const queued = trailing;
      if (!queued) {
        active = undefined;
        return;
      }

      trailing = undefined;
      const next = launch();
      void next.then(queued.resolve, queued.reject);
    };
    void request.then(finish, finish);
    return request;
  };

  return {
    activate: () => {
      disposed = false;
    },
    dispose: () => {
      disposed = true;
      active = undefined;
      const queued = trailing;
      trailing = undefined;
      queued?.resolve();
    },
    request: () => {
      if (disposed) return Promise.resolve();
      if (!active) return launch();
      if (trailing) return trailing.promise;

      let resolve!: () => void;
      let reject!: (error: unknown) => void;
      const promise = new Promise<void>((onResolve, onReject) => {
        resolve = onResolve;
        reject = onReject;
      });
      void promise.catch(() => undefined);
      trailing = { promise, resolve, reject };
      return promise;
    },
  };
}
