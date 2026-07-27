import { DatabaseSync } from 'node:sqlite';

// A node:sqlite beépített modul — nincs natív függőség, nincs fordítás a Dockerben.
// A szerver az EGYETLEN igazságforrás: nincs kliensoldali tár, nincs
// ütközésfeloldás. Lásd wiki/decisions/2026-07-27-online-only.md.

const SCHEMA_VERSION = 1;

/** A kezdő tevékenységpaletta. Lásd wiki/features/tevekenysegtipusok.md. */
export const DEFAULT_ACTIVITIES = [
  { id: 'alvas', label: 'Alvás', color: '#4A56C4', icon: '😴', sort: 10 },
  { id: 'altatas', label: 'Altatás', color: '#8B6FD0', icon: '🌙', sort: 20 },
  { id: 'etkezes', label: 'Étkezés', color: '#DE8A2C', icon: '🍽️', sort: 30 },
  { id: 'furdes', label: 'Fürdés', color: '#2A9CBE', icon: '🛁', sort: 40 },
  { id: 'jatek', label: 'Játék', color: '#3FA36E', icon: '🧸', sort: 50 },
  { id: 'program', label: 'Séta', color: '#8AA82E', icon: '🚶', sort: 60 },
  { id: 'bolcsi', label: 'Bölcsi', color: '#C0559B', icon: '🎒', sort: 70 },
];

export function openDb(path) {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 5000');
  migrate(db);
  return db;
}

function migrate(db) {
  const current = Number(db.prepare('PRAGMA user_version').get().user_version);
  if (current >= SCHEMA_VERSION) return;

  if (current < 1) {
    db.exec(`
      CREATE TABLE markers (
        id          TEXT    PRIMARY KEY,
        at          INTEGER NOT NULL,
        activity_id TEXT    NOT NULL,
        note        TEXT
      );
      CREATE INDEX markers_at ON markers(at);

      CREATE TABLE activities (
        id       TEXT    PRIMARY KEY,
        label    TEXT    NOT NULL,
        color    TEXT    NOT NULL,
        icon     TEXT,
        sort     INTEGER NOT NULL,
        archived INTEGER NOT NULL DEFAULT 0
      );
    `);
    const ins = db.prepare(
      'INSERT INTO activities(id,label,color,icon,sort,archived) VALUES(?,?,?,?,?,0)',
    );
    for (const a of DEFAULT_ACTIVITIES) ins.run(a.id, a.label, a.color, a.icon, a.sort);
  }

  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

const toMarker = (r) => ({ id: r.id, at: r.at, activityId: r.activity_id, note: r.note ?? null });
const toActivity = (r) => ({
  id: r.id,
  label: r.label,
  color: r.color,
  icon: r.icon ?? null,
  sort: r.sort,
  archived: !!r.archived,
});

// --- Tevékenységek --------------------------------------------------------

export const listActivities = (db) =>
  db.prepare('SELECT * FROM activities ORDER BY sort, id').all().map(toActivity);

export function upsertActivity(db, a) {
  db.prepare(
    `INSERT INTO activities(id,label,color,icon,sort,archived) VALUES(?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       label=excluded.label, color=excluded.color, icon=excluded.icon,
       sort=excluded.sort, archived=excluded.archived`,
  ).run(a.id, a.label, a.color, a.icon ?? null, a.sort, a.archived ? 1 : 0);
  return toActivity(db.prepare('SELECT * FROM activities WHERE id = ?').get(a.id));
}

/**
 * A tevékenységet archiváljuk, nem töröljük: különben a rá hivatkozó régi
 * markerek árván maradnának, és a múltbeli napok olvashatatlanná válnának.
 */
export function archiveActivity(db, id) {
  db.prepare('UPDATE activities SET archived = 1 WHERE id = ?').run(id);
}

// --- Markerek -------------------------------------------------------------

/**
 * A `[from, to)` tartomány markerei — PLUSZ a `from` előtti utolsó marker.
 *
 * A carry-in nem kényelmi extra: a nap első szegmensét szinte mindig egy
 * ELŐZŐ napi marker definiálja (az esti alvás). Enélkül a nap eleje üresnek
 * látszana. Lásd wiki/decisions/2026-07-27-hatarjelolo-adatmodell.md.
 */
export function listMarkers(db, from, to) {
  const inRange = db
    .prepare('SELECT * FROM markers WHERE at >= ? AND at < ? ORDER BY at')
    .all(from, to);
  const carry = db
    .prepare('SELECT * FROM markers WHERE at < ? ORDER BY at DESC LIMIT 1')
    .all(from);
  return [...carry, ...inRange].map(toMarker);
}

export function createMarker(db, m) {
  db.prepare('INSERT INTO markers(id,at,activity_id,note) VALUES(?,?,?,?)').run(
    m.id,
    m.at,
    m.activityId,
    m.note ?? null,
  );
  return toMarker(db.prepare('SELECT * FROM markers WHERE id = ?').get(m.id));
}

export function updateMarker(db, id, patch) {
  const cur = db.prepare('SELECT * FROM markers WHERE id = ?').get(id);
  if (!cur) return null;
  db.prepare('UPDATE markers SET at = ?, activity_id = ?, note = ? WHERE id = ?').run(
    patch.at ?? cur.at,
    patch.activityId ?? cur.activity_id,
    patch.note !== undefined ? patch.note : (cur.note ?? null),
    id,
  );
  return toMarker(db.prepare('SELECT * FROM markers WHERE id = ?').get(id));
}

export function deleteMarker(db, id) {
  // Hard delete: nincs szinkronkurzor, ami elől el kellene rejteni a törlést.
  return db.prepare('DELETE FROM markers WHERE id = ?').run(id).changes > 0;
}
