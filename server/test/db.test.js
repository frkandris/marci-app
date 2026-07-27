import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import {
  archiveActivity,
  createMarker,
  deleteActivity,
  deleteMarker,
  listActivities,
  listMarkers,
  openDb,
  reorderActivities,
  updateMarker,
  upsertActivity,
} from '../src/db.js';

const fresh = () => openDb(':memory:');
const at = (y, mo, d, h, mi = 0) => new Date(y, mo - 1, d, h, mi, 0, 0).getTime();

test('a migráció felveszi az alap tevékenységeket, sorrendben', () => {
  const db = fresh();
  const acts = listActivities(db);
  assert.equal(acts.length, 7);
  assert.equal(acts[0].id, 'alvas');
  assert.equal(acts.at(-1).id, 'ovi');
  assert.ok(acts.every((a) => a.archived === false));
});

test('marker létrehozás, módosítás, törlés', () => {
  const db = fresh();
  const m = createMarker(db, { id: 'm1', at: 1000, activityId: 'furdes', note: null });
  assert.deepEqual(m, { id: 'm1', at: 1000, activityId: 'furdes', note: null });

  const u = updateMarker(db, 'm1', { at: 2000 });
  assert.equal(u.at, 2000);
  assert.equal(u.activityId, 'furdes', 'a nem érintett mező nem változhat');

  assert.equal(updateMarker(db, 'nincs-ilyen', { at: 1 }), null);
  assert.equal(deleteMarker(db, 'm1'), true);
  assert.equal(deleteMarker(db, 'm1'), false);
});

test('CARRY-IN: a lekérés elhozza a from előtti utolsó markert is', () => {
  // Ez a rendszer legkönnyebben elrontható pontja: a nap első szegmensét
  // szinte mindig egy előző napi marker definiálja (az esti alvás).
  const db = fresh();
  createMarker(db, { id: 'reg', at: at(2026, 7, 20, 8), activityId: 'jatek' });
  createMarker(db, { id: 'alvas-elozo', at: at(2026, 7, 26, 19, 30), activityId: 'alvas' });
  createMarker(db, { id: 'ebredes', at: at(2026, 7, 27, 6, 30), activityId: 'jatek' });

  const rows = listMarkers(db, at(2026, 7, 27, 4), at(2026, 7, 28, 4));
  assert.deepEqual(
    rows.map((r) => r.id),
    ['alvas-elozo', 'ebredes'],
    'pontosan EGY carry-in marker jön a tartomány elé, a legutolsó',
  );
});

test('a carry-in hiányzik, ha nincs korábbi marker', () => {
  const db = fresh();
  createMarker(db, { id: 'a', at: at(2026, 7, 27, 8), activityId: 'jatek' });
  const rows = listMarkers(db, at(2026, 7, 27, 4), at(2026, 7, 28, 4));
  assert.deepEqual(
    rows.map((r) => r.id),
    ['a'],
  );
});

test('a tartomány félig nyílt: a to időpont már nem tartozik bele', () => {
  const db = fresh();
  const to = at(2026, 7, 28, 4);
  createMarker(db, { id: 'hatar', at: to, activityId: 'jatek' });
  const rows = listMarkers(db, at(2026, 7, 27, 4), to);
  assert.equal(
    rows.filter((r) => r.id === 'hatar').length,
    0,
    'a to-ra eső marker a KÖVETKEZŐ naphoz tartozik',
  );
});

test('a tevékenység archiválható, de nem tűnik el', () => {
  // Fizikai törlésnél a rá hivatkozó régi markerek árván maradnának,
  // és a múltbeli napok olvashatatlanná válnának.
  const db = fresh();
  archiveActivity(db, 'ovi');
  const acts = listActivities(db);
  assert.equal(acts.length, 7, 'a sor megmarad');
  assert.equal(acts.find((a) => a.id === 'ovi').archived, true);
});

test('az upsert létrehoz és frissít is', () => {
  const db = fresh();
  upsertActivity(db, { id: 'uzsonna', label: 'Uzsonna', color: '#112233', icon: '🍎', sort: 35 });
  assert.equal(listActivities(db).length, 8);

  const updated = upsertActivity(db, {
    id: 'uzsonna',
    label: 'Tízórai',
    color: '#445566',
    icon: '🥐',
    sort: 35,
  });
  assert.equal(updated.label, 'Tízórai');
  assert.equal(listActivities(db).length, 8, 'nem keletkezik duplikátum');
});

test('a carry-in azonos időbélyegnél is determinisztikus (id szerint tör holtversenyt)', () => {
  // Két backdate-elt marker ugyanarra a percre. A kliens at, majd id szerint
  // rendez — a szervernek ugyanazt kell utolsónak tekintenie, különben a
  // következő nap első szegmense más tevékenységet mutatna.
  const db = fresh();
  const t = at(2026, 7, 26, 19, 30);
  createMarker(db, { id: 'aaa', at: t, activityId: 'jatek' });
  createMarker(db, { id: 'zzz', at: t, activityId: 'alvas' });
  const rows = listMarkers(db, at(2026, 7, 27, 4), at(2026, 7, 28, 4));
  assert.equal(rows[0].id, 'zzz', 'a nagyobb id nyer, ahogy a kliens rendezésénél is');
});

test('a vegleges torles nem engedi arvan hagyni a markereket', () => {
  const db = fresh();
  createMarker(db, { id: 'm1', at: 1000, activityId: 'furdes' });

  const blocked = deleteActivity(db, 'furdes');
  assert.equal(blocked.deleted, false);
  assert.equal(blocked.usage, 1);
  assert.ok(listActivities(db).some((a) => a.id === 'furdes'), 'a tipus megmaradt');

  const forced = deleteActivity(db, 'furdes', { cascade: true });
  assert.equal(forced.deleted, true);
  assert.equal(listActivities(db).some((a) => a.id === 'furdes'), false);
});

test('a kaszkadolt torles URESRE valtja a savokat, nem dobja el a hatarokat', () => {
  // A marker eldobasa a HATART szuntetne meg, amitol az ELOZO tevekenyseg
  // elnyelne a savot — olyan idot tulajdonitva neki, ami nem az volt.
  const db = fresh();
  createMarker(db, { id: 'a', at: 1000, activityId: 'jatek' });
  createMarker(db, { id: 'b', at: 2000, activityId: 'furdes' });
  createMarker(db, { id: 'c', at: 3000, activityId: 'jatek' });

  deleteActivity(db, 'furdes', { cascade: true });

  const ms = listMarkers(db, 0, 9999999);
  assert.equal(ms.length, 3, 'a hatarok megmaradnak');
  assert.equal(ms.find((m) => m.id === 'b').activityId, '__none__', 'a sav URES lett');
  assert.equal(ms.find((m) => m.id === 'a').activityId, 'jatek', 'a szomszedok valtozatlanok');
});

test('a hasznalatban nem levo tipus cascade nelkul is torolheto', () => {
  const db = fresh();
  assert.equal(deleteActivity(db, 'ovi').deleted, true);
  assert.equal(listActivities(db).length, 6);
});

test('a listAllactivities usageCount-ot is ad', () => {
  const db = fresh();
  createMarker(db, { id: 'a', at: 1, activityId: 'alvas' });
  createMarker(db, { id: 'b', at: 2, activityId: 'alvas' });
  const acts = listActivities(db);
  assert.equal(acts.find((a) => a.id === 'alvas').usageCount, 2);
  assert.equal(acts.find((a) => a.id === 'jatek').usageCount, 0);
});

test('az atrendezes a kapott sorrendet allitja be', () => {
  const db = fresh();
  const ids = listActivities(db).map((a) => a.id);
  const reversed = [...ids].reverse();
  const out = reorderActivities(db, reversed);
  assert.deepEqual(out.map((a) => a.id), reversed);
  assert.deepEqual(listActivities(db).map((a) => a.id), reversed, 'a sorrend perzisztens');
});

test('a v2 migracio atnevezi a bolcsit ovira, a markereivel egyutt', () => {
  // Régi sémájú adatbázis szimulálása, majd újranyitás -> migráció fut.
  const path = join(tmpdir(), `marci-mig-${Math.random().toString(36).slice(2)}.db`);
  const old = new DatabaseSync(path);
  old.exec(`
    CREATE TABLE markers (id TEXT PRIMARY KEY, at INTEGER NOT NULL, activity_id TEXT NOT NULL, note TEXT);
    CREATE TABLE activities (id TEXT PRIMARY KEY, label TEXT NOT NULL, color TEXT NOT NULL, icon TEXT, sort INTEGER NOT NULL, archived INTEGER NOT NULL DEFAULT 0);
    INSERT INTO activities VALUES ('bolcsi','Bölcsi','#C0559B','🎒',70,0);
    INSERT INTO markers VALUES ('m1', 1000, 'bolcsi', NULL);
    PRAGMA user_version = 1;
  `);
  old.close();

  const db = openDb(path);
  const acts = listActivities(db);
  assert.equal(acts.some((a) => a.id === 'bolcsi'), false, 'a regi id eltunt');
  assert.equal(acts.find((a) => a.id === 'ovi').label, 'Ovi');
  assert.equal(listMarkers(db, 0, 9999).at(-1).activityId, 'ovi', 'a marker is atallt');
});

test('a v3 migracio emoji ikonokat ikonnevekre cserel', () => {
  const path = join(tmpdir(), `marci-mig3-${Math.random().toString(36).slice(2)}.db`);
  const old = new DatabaseSync(path);
  old.exec(`
    CREATE TABLE markers (id TEXT PRIMARY KEY, at INTEGER NOT NULL, activity_id TEXT NOT NULL, note TEXT);
    CREATE TABLE activities (id TEXT PRIMARY KEY, label TEXT NOT NULL, color TEXT NOT NULL, icon TEXT, sort INTEGER NOT NULL, archived INTEGER NOT NULL DEFAULT 0);
    INSERT INTO activities VALUES ('alvas','Alvás','#4A56C4','😴',10,0);
    INSERT INTO activities VALUES ('sajat','Saját','#123456','🦄',80,0);
    PRAGMA user_version = 2;
  `);
  old.close();

  const acts = listActivities(openDb(path));
  assert.equal(acts.find((a) => a.id === 'alvas').icon, 'moon', 'ismert id -> illo ikon');
  assert.equal(acts.find((a) => a.id === 'sajat').icon, 'star', 'ismeretlen -> altalanos ikon');
});

test('az upsert visszaadja a usageCount-ot is', () => {
  // Enélkül a felület mentés után "0 esemény"-t írna egy sokat használt
  // tevékenységre, a következő lekérésig.
  const db = fresh();
  createMarker(db, { id: 'm1', at: 1, activityId: 'alvas' });
  createMarker(db, { id: 'm2', at: 2, activityId: 'alvas' });
  const row = upsertActivity(db, {
    id: 'alvas', label: 'Alvás', color: '#4A56C4', icon: 'moon', sort: 10,
  });
  assert.equal(row.usageCount, 2);
});

test('a v2 migracio akkor is atvezet, ha az "ovi" MAR letezik', () => {
  const path = join(tmpdir(), `marci-mig2b-${Math.random().toString(36).slice(2)}.db`);
  const old = new DatabaseSync(path);
  old.exec(`
    CREATE TABLE markers (id TEXT PRIMARY KEY, at INTEGER NOT NULL, activity_id TEXT NOT NULL, note TEXT);
    CREATE TABLE activities (id TEXT PRIMARY KEY, label TEXT NOT NULL, color TEXT NOT NULL, icon TEXT, sort INTEGER NOT NULL, archived INTEGER NOT NULL DEFAULT 0);
    INSERT INTO activities VALUES ('bolcsi','Bölcsi','#C0559B','backpack',70,0);
    INSERT INTO activities VALUES ('ovi','Ovi','#C0559B','backpack',80,0);
    INSERT INTO markers VALUES ('m1', 1000, 'bolcsi', NULL);
    PRAGMA user_version = 1;
  `);
  old.close();

  const db = openDb(path);
  const acts = listActivities(db);
  assert.equal(acts.some((a) => a.id === 'bolcsi'), false, 'a duplikatum eltunt');
  assert.equal(acts.filter((a) => a.id === 'ovi').length, 1);
  assert.equal(listMarkers(db, 0, 9999).at(-1).activityId, 'ovi', 'a marker atallt');
});
