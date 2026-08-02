import type {
  PersistedSourceDraftWorkspace,
  SourceDraftPersistenceAdapter,
  SourceDraftPersistenceMutation,
} from "./source-draft-workspace-types";

export function createMemorySourceDraftPersistence(
  initial?: PersistedSourceDraftWorkspace,
): SourceDraftPersistenceAdapter & { inspect(): PersistedSourceDraftWorkspace | undefined } {
  let value = clone(initial);
  const listeners = new Set<(mutation: SourceDraftPersistenceMutation) => void>();
  return {
    async load() {
      return clone(value);
    },
    async mutate(mutation) {
      value = applyMutation(value, mutation);
      listeners.forEach((listener) => listener(clone(mutation)));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    inspect() {
      return clone(value);
    },
  };
}

export type IndexedDbSourceDraftPersistenceOptions = {
  databaseName?: string;
  storeName?: string;
  recordKey?: string;
};

export function createIndexedDbSourceDraftPersistence(
  options: IndexedDbSourceDraftPersistenceOptions = {},
): SourceDraftPersistenceAdapter {
  const databaseName = options.databaseName ?? "design-space-source-drafts";
  const storeName = options.storeName ?? "workspace";
  const recordKey = options.recordKey ?? "active";
  const listeners = new Set<(mutation: SourceDraftPersistenceMutation) => void>();
  const channel = typeof BroadcastChannel === "undefined"
    ? undefined
    : new BroadcastChannel(`${databaseName}:${storeName}:${recordKey}`);
  if (channel) {
    channel.onmessage = (event: MessageEvent<SourceDraftPersistenceMutation>) => {
      const mutation = event.data;
      if (!isPersistenceMutation(mutation)) return;
      listeners.forEach((listener) => listener(clone(mutation)));
    };
  }

  return {
    async load() {
      const database = await openDatabase(databaseName, storeName);
      try {
        return await requestResult<PersistedSourceDraftWorkspace | undefined>(
          database.transaction(storeName, "readonly").objectStore(storeName).get(recordKey),
        );
      } finally {
        database.close();
      }
    },
    async mutate(mutation) {
      const database = await openDatabase(databaseName, storeName);
      try {
        await mutateRecord(database, storeName, recordKey, mutation);
        listeners.forEach((listener) => listener(clone(mutation)));
        channel?.postMessage(mutation);
      } finally {
        database.close();
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function openDatabase(databaseName: string, storeName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName);
    };
    request.onerror = () => reject(request.error ?? new Error("The source draft cache could not be opened."));
    request.onsuccess = () => resolve(request.result);
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error("The source draft cache request failed."));
    request.onsuccess = () => resolve(request.result);
  });
}

function mutateRecord(
  database: IDBDatabase,
  storeName: string,
  recordKey: string,
  mutation: SourceDraftPersistenceMutation,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("The source draft cache transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("The source draft cache transaction was aborted."));
    const request = store.get(recordKey) as IDBRequest<PersistedSourceDraftWorkspace | undefined>;
    request.onerror = () => transaction.abort();
    request.onsuccess = () => store.put(applyMutation(request.result, mutation), recordKey);
  });
}

function applyMutation(
  current: PersistedSourceDraftWorkspace | undefined,
  mutation: SourceDraftPersistenceMutation,
): PersistedSourceDraftWorkspace {
  const entries = new Map((current?.version === 1 ? current.entries : []).map((entry) => [entry.key, entry]));
  mutation.removals.forEach((key) => entries.delete(key));
  mutation.upserts.forEach((entry) => entries.set(entry.key, clone(entry)));
  return { version: 1, entries: [...entries.values()] };
}

function isPersistenceMutation(value: unknown): value is SourceDraftPersistenceMutation {
  if (!value || typeof value !== "object") return false;
  const mutation = value as Partial<SourceDraftPersistenceMutation>;
  return typeof mutation.origin === "string"
    && Array.isArray(mutation.removals)
    && mutation.removals.every((key) => typeof key === "string")
    && Array.isArray(mutation.upserts);
}

function clone<T>(value: T): T {
  return value === undefined ? value : structuredClone(value);
}
