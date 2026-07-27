import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DAY_START_HOUR,
  NONE,
  dayBounds,
  dayKey,
  dragBounds,
  markersIn,
  previousOf,
  runningMarker,
  sameClockPreviousDay,
  segmentsFor,
  shiftDayKey,
  snap,
} from '../src/model.ts';
import type { Marker } from '../src/model.ts';

const at = (y: number, mo: number, d: number, h: number, mi = 0) =>
  new Date(y, mo - 1, d, h, mi, 0, 0).getTime();

const mk = (id: string, t: number, activityId: string): Marker => ({
  id,
  at: t,
  activityId,
  note: null,
});

test('a logikai nap 04:00-kor vált, nem éjfélkor', () => {
  assert.equal(dayKey(at(2026, 7, 27, 3, 30)), '2026-07-26', '03:30 még az előző naphoz tartozik');
  assert.equal(dayKey(at(2026, 7, 27, 4, 0)), '2026-07-27', '04:00 már az új nap');
  assert.equal(dayKey(at(2026, 7, 27, 23, 0)), '2026-07-27');
  assert.equal(DAY_START_HOUR, 4);
});

test('a nap határai a 04:00–04:00 félig nyílt intervallum', () => {
  const [from, to] = dayBounds('2026-07-27');
  assert.equal(from, at(2026, 7, 27, 4));
  assert.equal(to, at(2026, 7, 28, 4));
});

test('a nyári időszámítás váltásakor a nap 23 vagy 25 órás, a rács nem csúszik el', () => {
  // 2026-03-29: az EU-ban ekkor vált a nyári időszámítás.
  const [from, to] = dayBounds('2026-03-28');
  const hours = (to - from) / 3600_000;
  assert.ok(hours === 23 || hours === 24 || hours === 25, `váratlan naphossz: ${hours}`);
  // A napkezdet mindig HELYI 04:00 marad, akkor is, ha a nap nem 24 órás.
  assert.equal(new Date(from).getHours(), 4);
  assert.equal(new Date(to).getHours(), 4);
});

test('CARRY-IN: a nap első szegmensét egy előző napi marker definiálja', () => {
  // Ez a modell legkönnyebben elrontható pontja. Az alvás 19:30-kor kezdődik
  // az előző napon, és belenyúlik a vizsgált napba.
  const markers = [
    mk('sleep', at(2026, 7, 26, 19, 30), 'alvas'),
    mk('wake', at(2026, 7, 27, 6, 30), 'jatek'),
  ];
  const [from, to] = dayBounds('2026-07-27');
  const segs = segmentsFor(markers, from, to, at(2026, 7, 27, 12));

  assert.equal(segs.length, 2);
  assert.equal(segs[0].activityId, 'alvas');
  assert.equal(segs[0].start, from, 'a nap elején a szegmens a nap kezdetére van vágva');
  assert.equal(segs[0].end, at(2026, 7, 27, 6, 30));
  assert.equal(segs[0].clippedStart, true, 'jelezni kell, hogy a valódi hossz nagyobb');
  assert.equal(segs[0].clippedEnd, false);
});

test('a __none__ lezár egy szegmenst anélkül, hogy újat nyitna', () => {
  const markers = [
    mk('a', at(2026, 7, 27, 8), 'etkezes'),
    mk('b', at(2026, 7, 27, 8, 30), NONE),
    mk('c', at(2026, 7, 27, 10), 'jatek'),
  ];
  const [from, to] = dayBounds('2026-07-27');
  const segs = segmentsFor(markers, from, to, at(2026, 7, 27, 12));
  assert.deepEqual(
    segs.map((s) => s.activityId),
    ['etkezes', 'jatek'],
    'a __none__ nem ad szegmenst, de lezárja az előzőt',
  );
  assert.equal(segs[0].end, at(2026, 7, 27, 8, 30));
  assert.equal(segs[1].start, at(2026, 7, 27, 10), 'a lyuk megmarad, nem olvad össze');
});

test('a futó tevékenység a jelen pillanatig tart, jövőbeli napon nincs szegmens', () => {
  const now = at(2026, 7, 27, 15);
  const markers = [mk('a', at(2026, 7, 27, 14), 'jatek')];
  const [from, to] = dayBounds('2026-07-27');
  assert.equal(segmentsFor(markers, from, to, now)[0].end, now);

  const [f2, t2] = dayBounds('2026-07-28');
  assert.equal(segmentsFor(markers, f2, t2, now).length, 0, 'jövőbeli nap üres');
});

test('a húzás szigorúan a szomszédok közé korlátozódik', () => {
  const markers = [
    mk('a', at(2026, 7, 27, 8), 'jatek'),
    mk('b', at(2026, 7, 27, 9), 'etkezes'),
    mk('c', at(2026, 7, 27, 10), 'jatek'),
  ];
  const [min, max] = dragBounds(markers, 'b');
  assert.equal(min, at(2026, 7, 27, 8) + 1);
  assert.equal(max, at(2026, 7, 27, 10) - 1);
  // A szélső markereknek nincs egyik oldalon korlátjuk.
  assert.equal(dragBounds(markers, 'a')[0], -Infinity);
  assert.equal(dragBounds(markers, 'c')[1], Infinity);
});

test('markersIn csak a napon belüli fogantyúkat adja vissza', () => {
  const markers = [
    mk('elozo', at(2026, 7, 26, 19, 30), 'alvas'),
    mk('bent', at(2026, 7, 27, 6, 30), 'jatek'),
  ];
  const [from, to] = dayBounds('2026-07-27');
  assert.deepEqual(
    markersIn(markers, from, to).map((m) => m.id),
    ['bent'],
    'az előző napi carry-in marker nem húzható ezen a napon',
  );
});

test('runningMarker null, ha az utolsó marker __none__', () => {
  const markers = [mk('a', at(2026, 7, 27, 8), 'jatek'), mk('b', at(2026, 7, 27, 9), NONE)];
  assert.equal(runningMarker(markers), null);
  assert.equal(runningMarker([markers[0]])?.id, 'a');
});

test('a snap 5 perces rácsra kerekít', () => {
  assert.equal(snap(at(2026, 7, 27, 8, 2)), at(2026, 7, 27, 8, 0));
  assert.equal(snap(at(2026, 7, 27, 8, 3)), at(2026, 7, 27, 8, 5));
});

test('shiftDayKey hónaphatáron is helyes', () => {
  assert.equal(shiftDayKey('2026-07-31', 1), '2026-08-01');
  assert.equal(shiftDayKey('2026-01-01', -1), '2025-12-31');
});

test('runningMarker figyelmen kívül hagyja a jövőbeli markert', () => {
  // Egy elgépelt visszamenőleges rögzítés jövőbeli markert hozhat létre.
  // Enélkül az válna „futóvá", és a stopper 0:00-t mutatna.
  const now = at(2026, 7, 27, 15);
  const markers = [
    mk('most', at(2026, 7, 27, 14), 'jatek'),
    mk('jovo', at(2026, 7, 28, 5), 'alvas'),
  ];
  assert.equal(runningMarker(markers, now)?.id, 'most');
});

test('INVARIÁNS: dayBounds(dayKey(t)) mindig tartalmazza t-t — óraátállításkor is', () => {
  // Ez a legerősebb állítás a naplogikáról. Ha elromlik, egy esemény olyan naphoz
  // sorolódik, aminek a tartományába bele sem esik. Az `at - 4 óra` abszolút
  // kivonás pontosan ezt okozta a tavaszi váltásnál.
  const probes: number[] = [];
  for (const [mo, d] of [[3, 28], [3, 29], [3, 30], [10, 24], [10, 25], [10, 26], [7, 27]]) {
    for (let h = 0; h < 24; h++) for (const mi of [0, 30, 59]) {
      probes.push(at(2026, mo, d, h, mi));
    }
  }
  for (const t of probes) {
    const [from, to] = dayBounds(dayKey(t));
    assert.ok(
      t >= from && t < to,
      `${new Date(t).toString()} a(z) ${dayKey(t)} naphoz sorolódott, de a tartomány ` +
        `[${new Date(from).toString()}, ${new Date(to).toString()}) nem tartalmazza`,
    );
  }
});

test('sameClockPreviousDay megőrzi a helyi óra:percet az óraátállítás napján is', () => {
  const t = at(2026, 3, 29, 23, 0);
  const prev = new Date(sameClockPreviousDay(t));
  assert.equal(prev.getHours(), 23, 'a helyi óra nem csúszhat el');
  assert.equal(prev.getMinutes(), 0);
  assert.equal(prev.getDate(), 28);
});

test('a jövőbeli marker nem nyújtja a jelenbe az előtte lévő szegmenst', () => {
  const now = at(2026, 7, 27, 15);
  const markers = [
    mk('most', at(2026, 7, 27, 14), 'jatek'),
    mk('elgepelt-jovo', at(2026, 7, 27, 20), 'alvas'),
  ];
  const [from, to] = dayBounds('2026-07-27');
  const segs = segmentsFor(markers, from, to, now);
  assert.equal(segs.length, 1, 'a jövőbeli marker maga nem ad szegmenst');
  assert.equal(segs[0].end, now, 'az előtte lévő szegmens a JELENIG tart, nem 20:00-ig');
});

test('previousOf a megelőző markert adja — ehhez tér vissza a „mégsem ez volt"', () => {
  const markers = [
    mk('a', at(2026, 7, 27, 8), 'jatek'),
    mk('b', at(2026, 7, 27, 9), 'etkezes'),
    mk('c', at(2026, 7, 27, 10), 'furdes'),
  ];
  assert.equal(previousOf(markers, 'c')?.id, 'b');
  assert.equal(previousOf(markers, 'a'), null, 'az elsőnek nincs előzője');
  assert.equal(previousOf(markers, 'nincs'), null);
});
