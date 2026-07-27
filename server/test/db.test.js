import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  archiveActivity,
  createMarker,
  deleteMarker,
  listActivities,
  listMarkers,
  openDb,
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
  assert.equal(acts.at(-1).id, 'bolcsi');
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
  archiveActivity(db, 'bolcsi');
  const acts = listActivities(db);
  assert.equal(acts.length, 7, 'a sor megmarad');
  assert.equal(acts.find((a) => a.id === 'bolcsi').archived, true);
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
