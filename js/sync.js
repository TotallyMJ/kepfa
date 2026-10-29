// Two-way sync between the local jar (IndexedDB) and the cloud, for signed-in owners.
// Phase 2 covers metadata + photo/thumb; Live clips come in phase 3 (has_live is flagged now).
// The reconcile is last-write-wins by updatedAt, and deletes travel as soft-deletes (deleted_at),
// so removing a sky on one device removes it on the others. Everything is best-effort: a failed
// upload or a lost connection just leaves the work for the next sync.

import { store } from './store.js';
import { supaClient, session } from './cloud.js';

const PHOTOS = 'photos';
const TOMB = 'kepfa.tombstones';
const ms = (iso) => new Date(iso).getTime();
const iso = (n) => new Date(n).toISOString();
const path = (uid, id, name) => `${uid}/${id}/${name}`;
const stamp = (sky) => sky.updatedAt || sky.createdAt || sky.takenAt;

/** Record a deletion so the next sync can soft-delete it in the cloud. Safe to call when signed out. */
export function queueDelete(id) {
  try {
    const t = JSON.parse(localStorage.getItem(TOMB) || '{}');
    t[id] = Date.now();
    localStorage.setItem(TOMB, JSON.stringify(t));
  } catch { /* a local-only delete, then */ }
}
const readTombs = () => { try { return JSON.parse(localStorage.getItem(TOMB) || '{}'); } catch { return {}; } };
const clearTombs = () => { try { localStorage.removeItem(TOMB); } catch { /* flushed anyway */ } };

function rowOf(uid, sky) {
  return {
    id: sky.id, user_id: uid,
    taken_at: iso(sky.takenAt), note: sky.note || '', place: sky.place || '',
    prompt: sky.prompt || '', prompt_text: sky.promptText || '',
    palette: sky.palette || null, front: !!sky.front, has_live: !!sky.live,
    photo_path: path(uid, sky.id, 'photo'),
    thumb_path: sky.thumb ? path(uid, sky.id, 'thumb') : null,
    live_path: null,
    created_at: iso(sky.createdAt || sky.takenAt), updated_at: iso(stamp(sky)), deleted_at: null,
  };
}

async function upload(c, uid, sky) {
  await c.storage.from(PHOTOS).upload(path(uid, sky.id, 'photo'), sky.photo,
    { upsert: true, contentType: sky.photo?.type || 'image/jpeg' });
  if (sky.thumb) await c.storage.from(PHOTOS).upload(path(uid, sky.id, 'thumb'), sky.thumb,
    { upsert: true, contentType: sky.thumb.type || 'image/jpeg' });
  await c.from('skies').upsert(rowOf(uid, sky));
}

// Metadata changed locally (note, place, date) but the photo is the same, so only the row updates.
async function pushMeta(c, sky) {
  await c.from('skies').update({
    note: sky.note || '', place: sky.place || '', taken_at: iso(sky.takenAt),
    prompt: sky.prompt || '', prompt_text: sky.promptText || '', has_live: !!sky.live,
    updated_at: iso(stamp(sky)), deleted_at: null,
  }).eq('id', sky.id);
}

async function download(c, row) {
  const photo = (await c.storage.from(PHOTOS).download(row.photo_path)).data;
  if (!photo) return null;   // can't rebuild a sky without its photo; try again next sync
  let thumb = photo;
  if (row.thumb_path) { const t = (await c.storage.from(PHOTOS).download(row.thumb_path)).data; if (t) thumb = t; }
  return {
    id: row.id, takenAt: ms(row.taken_at), note: row.note || '', place: row.place || '',
    prompt: row.prompt || '', promptText: row.prompt_text || '', palette: row.palette,
    photo, thumb, live: null, front: !!row.front, sample: false,
    createdAt: ms(row.created_at), updatedAt: ms(row.updated_at),
  };
}

/**
 * Reconcile this device with the cloud once. Returns { ok, changed }, where `changed` means the
 * local store gained, lost or updated a sky and the caller should reload and re-render.
 */
export async function syncNow() {
  const s = await session();
  if (!s) return { ok: false };
  let c;
  try { c = await supaClient(); } catch { return { ok: false }; }
  const uid = s.user.id;

  try {
    // Push pending deletes first, so a re-download can't resurrect them.
    const tombs = readTombs();
    for (const [id, at] of Object.entries(tombs)) {
      await c.from('skies').update({ deleted_at: iso(at), updated_at: iso(at) }).eq('id', id);
    }
    clearTombs();

    const { data: rows, error } = await c.from('skies').select('*');
    if (error) return { ok: false, error };
    const cloud = new Map(rows.map((r) => [r.id, r]));
    const local = (await store.all()).filter((x) => !x.sample);
    const localIds = new Set(local.map((x) => x.id));
    let changed = false;

    // Local -> cloud, and pull edits the cloud won.
    for (const sky of local) {
      const row = cloud.get(sky.id);
      if (!row) { await upload(c, uid, sky); continue; }
      if (row.deleted_at) { await store.remove(sky.id); changed = true; continue; }
      const lu = stamp(sky), ru = ms(row.updated_at);
      if (lu > ru) await pushMeta(c, sky);
      else if (ru > lu) { await store.put({ ...sky, note: row.note || '', place: row.place || '', takenAt: ms(row.taken_at), prompt: row.prompt || '', promptText: row.prompt_text || '', updatedAt: ru }); changed = true; }
    }

    // Cloud -> local for skies this device has never seen.
    for (const row of rows) {
      if (localIds.has(row.id) || row.deleted_at) continue;
      const sky = await download(c, row);
      if (sky) { await store.put(sky); changed = true; }
    }

    return { ok: true, changed };
  } catch (error) {
    return { ok: false, error };
  }
}
