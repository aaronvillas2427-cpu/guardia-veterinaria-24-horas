const DB_NAME = "guardia-vet-24h";
const VERSION = 1;

export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB no disponible"));
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, VERSION);
    } catch (e) {
      return reject(e);
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("events")) db.createObjectStore("events", { keyPath: "id" });
      if (!db.objectStoreNames.contains("blobs")) db.createObjectStore("blobs");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("No se pudo abrir IndexedDB"));
    req.onblocked = () => reject(new Error("IndexedDB bloqueado"));
  });
}

const done = (tx: IDBTransaction) =>
  new Promise<void>((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error);
  });

const result = <T>(req: IDBRequest<T>) =>
  new Promise<T>((res, rej) => {
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });

export const getAllEvents = (db: IDBDatabase) =>
  result<unknown[]>(db.transaction("events").objectStore("events").getAll());

export const getBlob = (db: IDBDatabase, key: string) =>
  result<unknown>(db.transaction("blobs").objectStore("blobs").get(key));

/** Solo agrega: los eventos nunca se modifican ni borran salvo al restaurar todo. */
export async function appendEvent(db: IDBDatabase, e: unknown) {
  const tx = db.transaction("events", "readwrite");
  tx.objectStore("events").add(e);
  await done(tx);
}

export async function replaceAll(db: IDBDatabase, events: unknown[], blobs: Record<string, unknown>) {
  const tx = db.transaction(["events", "blobs"], "readwrite");
  const es = tx.objectStore("events");
  const bs = tx.objectStore("blobs");
  es.clear();
  bs.clear();
  for (const e of events) es.add(e);
  for (const [k, v] of Object.entries(blobs)) bs.put(v, k);
  await done(tx);
}
