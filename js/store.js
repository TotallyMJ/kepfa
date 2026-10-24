// Local-first storage: every sky (photo blobs + palette + note) lives in IndexedDB on this device.
// Falls back to an in-memory list when IndexedDB is blocked (private mode on some browsers).

const DB_NAME = 'skyjar';
const STORE = 'skies';
const VERSION = 1;

let dbPromise = null;
let memory = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const s = req.result.createObjectStore(STORE, { keyPath: 'id' });
        s.createIndex('takenAt', 'takenAt');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function run(mode, fn) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

async function usable() {
  if (memory) return false;
  try { await openDb(); return true; } catch { memory = []; return false; }
}

export const store = {
  /** True when data survives a reload on this device. */
  async persistent() { return usable(); },

  async all() {
    if (!(await usable())) return memory.slice();
    const rows = await run('readonly', (s) => s.getAll());
    return rows.sort((a, b) => a.takenAt - b.takenAt);
  },

  async put(sky) {
    if (!(await usable())) { memory = memory.filter((s) => s.id !== sky.id).concat(sky); return; }
    await run('readwrite', (s) => s.put(sky));
  },

  async remove(id) {
    if (!(await usable())) { memory = memory.filter((s) => s.id !== id); return; }
    await run('readwrite', (s) => s.delete(id));
  },
};

export function newId() {
  if (globalThis.crypto?.randomUUID && isSecureContext) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
