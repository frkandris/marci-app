import { DatabaseSync } from 'node:sqlite';

// A node:sqlite beépített modul — nincs natív függőség, nincs fordítás a Dockerben.
// A szerver az EGYETLEN igazságforrás: nincs kliensoldali tár, nincs
// ütközésfeloldás. Lásd wiki/decisions/2026-07-27-online-only.md.

const SCHEMA_VERSION = 3;

/** A kezdő tevékenységpaletta. Lásd wiki/features/tevekenysegtipusok.md. */
export const DEFAULT_ACTIVITIES = [
  { id: 'alvas', label: 'Alvás', color: '#4A56C4', icon: 'moon', sort: 10 },
  { id: 'altatas', label: 'Altatás', color: '#8B6FD0', icon: 'bed', sort: 20 },
  { id: 'etkezes', label: 'Étkezés', color: '#DE8A2C', icon: 'bowl', sort: 30 },
  { id: 'furdes', label: 'Fürdés', color: '#2A9CBE', icon: 'droplet', sort: 40 },
  { id: 'jatek', label: 'Játék', color: '#3FA36E', icon: 'blocks', sort: 50 },
  { id: 'program', label: 'Séta', color: '#8AA82E', icon: 'shoe', sort: 60 },
  { id: 'ovi', label: 'Ovi', color: '#C0559B', icon: 'backpack', sort: 70 },
];

export function openDb(path) {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 5000');
  migrate(db);
  return db;
}

/**
 * Egy migrációs lépés: a séma módosítása ÉS a verziószám írása EGY
 * tranzakcióban. Enélkül egy megszakadt első indítás után a következő
 * indítás újra lefuttatná a `CREATE TABLE`-t egy már létező táblán, és az
 * adatbázis véglegesen megnyithatatlanná válna.
 */
function step(db, version, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    fn();
    db.exec(`PRAGMA user_version = ${version}`);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function migrate(db) {
  const current = Number(db.prepare('PRAGMA user_version').get().user_version);
  if (current >= SCHEMA_VERSION) return;

  if (current < 1) {
    step(db, 1, () => {
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
    });
  }

  if (current < 2) {
    step(db, 2, () => {
      // A 'bolcsi' -> 'ovi' átnevezés a markereket is átvezeti, különben árván
      // maradnának.
      const hasOld = db.prepare("SELECT 1 FROM activities WHERE id = 'bolcsi'").get();
      const hasNew = db.prepare("SELECT 1 FROM activities WHERE id = 'ovi'").get();
      if (hasOld) {
        db.exec("UPDATE markers SET activity_id = 'ovi' WHERE activity_id = 'bolcsi'");
        // Ha az 'ovi' MÁR létezik (a felhasználó maga is létrehozhatta), a
        // régi sort eldobjuk — különben két azonos jelentésű kategória
        // maradna, örökre migrálatlanul.
        if (hasNew) db.exec("DELETE FROM activities WHERE id = 'bolcsi'");
        else db.exec("UPDATE activities SET id = 'ovi', label = 'Ovi' WHERE id = 'bolcsi'");
      }
    });
  }

  if (current < 3) {
    step(db, 3, () => {
      // Emoji ikonok -> saját ikonkészlet nevei.
      const BY_ID = {
        alvas: 'moon', altatas: 'bed', etkezes: 'bowl', furdes: 'droplet',
        jatek: 'blocks', program: 'shoe', ovi: 'backpack', bolcsi: 'backpack',
      };
      const VALID = new Set(Object.values(BY_ID).concat([
        'bottle', 'sun', 'car', 'book', 'music', 'heart', 'health', 'star', 'stop',
        'person', 'people',
      ]));
      const upd = db.prepare('UPDATE activities SET icon = ? WHERE id = ?');
      for (const a of db.prepare('SELECT id, icon FROM activities').all()) {
        if (a.icon && VALID.has(a.icon)) continue;
        upd.run(BY_ID[a.id] ?? 'star', a.id);
      }
    });
  }
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

/** A `usageCount` a törlés/archiválás eldöntéséhez kell a felületen. */
export const listActivities = (db) =>
  db
    .prepare(
      `SELECT a.*, (SELECT COUNT(*) FROM markers m WHERE m.activity_id = a.id) AS usage_count
       FROM activities a ORDER BY a.sort, a.id`,
    )
    .all()
    .map((r) => ({ ...toActivity(r), usageCount: r.usage_count }));

export function upsertActivity(db, a) {
  db.prepare(
    `INSERT INTO activities(id,label,color,icon,sort,archived) VALUES(?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       label=excluded.label, color=excluded.color, icon=excluded.icon,
       sort=excluded.sort, archived=excluded.archived`,
  ).run(a.id, a.label, a.color, a.icon ?? null, a.sort, a.archived ? 1 : 0);
  // A usageCount is menjen vissza, különben a felület mentés után átmenetileg
  // "0 esemény"-t mutatna egy sokat használt tevékenységre.
  return { ...toActivity(db.prepare('SELECT * FROM activities WHERE id = ?').get(a.id)),
           usageCount: activityUsage(db, a.id) };
}

/**
 * A tevékenységet archiváljuk, nem töröljük: különben a rá hivatkozó régi
 * markerek árván maradnának, és a múltbeli napok olvashatatlanná válnának.
 */
export function archiveActivity(db, id) {
  db.prepare('UPDATE activities SET archived = 1 WHERE id = ?').run(id);
}

/** A `__none__` pszeudotípus mindig érvényes, de nincs sora az `activities`-ben. */
export const activityExists = (db, id) =>
  id === '__none__' || !!db.prepare('SELECT 1 FROM activities WHERE id = ?').get(id);

export const activityUsage = (db, id) =>
  Number(db.prepare('SELECT COUNT(*) AS n FROM markers WHERE activity_id = ?').get(id).n);

/**
 * Végleges törlés. `cascade` nélkül csak akkor engedjük, ha egyetlen marker sem
 * hivatkozik rá — különben a régi napok árva azonosítót mutatnának.
 * `cascade`-del a hivatkozó markerek is törlődnek, egy tranzakcióban.
 */
/**
 * Tevékenység végleges törlése.
 *
 * `cascade` esetén a hivatkozó markereket NEM dobjuk el, hanem `__none__`-ra
 * állítjuk. A törlés ugyanis a HATÁRT szüntetné meg, amitől az előző
 * tevékenység elnyelné a sávot — vagyis olyan időt tulajdonítanánk neki, ami
 * nem az volt. Így a sávok üresek (nem rögzítettek) lesznek, a többi nap
 * pedig érintetlen marad.
 */
export function deleteActivity(db, id, { cascade = false } = {}) {
  const used = activityUsage(db, id);
  if (used > 0 && !cascade) return { deleted: false, usage: used };

  db.exec('BEGIN IMMEDIATE');
  try {
    if (cascade) {
      db.prepare("UPDATE markers SET activity_id = '__none__' WHERE activity_id = ?").run(id);
    }
    db.prepare('DELETE FROM activities WHERE id = ?').run(id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return { deleted: true, usage: used };
}

/** Átrendezés: a kapott sorrend szerint 10-esével újraosztja a `sort` értékeket. */
export function reorderActivities(db, ids) {
  const upd = db.prepare('UPDATE activities SET sort = ? WHERE id = ?');
  db.exec('BEGIN IMMEDIATE');
  try {
    ids.forEach((id, i) => upd.run((i + 1) * 10, id));
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return listActivities(db);
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
  // A holtversenytörés `id`-re nem szépészet: a kliens is `at`, majd `id` szerint
  // rendez, és ha két backdate-elt marker azonos percre esik, enélkül a szerver
  // más sort adna vissza carry-inként, mint amit a kliens utolsónak tekint.
  const carry = db
    .prepare('SELECT * FROM markers WHERE at < ? ORDER BY at DESC, id DESC LIMIT 1')
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
