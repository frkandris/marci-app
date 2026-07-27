import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DAY_START_HOUR,
  NONE,
  dailyTotals,
  dayBounds,
  dayKey,
  dragBounds,
  markersIn,
  nextOf,
  previousOf,
  rankedActivities,
  retimeMarker,
  runningMarker,
  sameClockPreviousDay,
  segmentWidthPct,
  segmentsFor,
  shiftDayKey,
  snap,
  timeInLogicalDay,
  toTimeInput,
  usageScores,
  wallClockPct,
} from '../src/model.ts';
import type { Activity, Marker } from '../src/model.ts';

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

test('dailyTotals tevékenységenként összegez, hossz szerint rendezve', () => {
  const markers = [
    mk('a', at(2026, 7, 27, 8), 'jatek'),
    mk('b', at(2026, 7, 27, 9), 'etkezes'),
    mk('c', at(2026, 7, 27, 9, 30), 'jatek'),
    mk('d', at(2026, 7, 27, 12), NONE),
  ];
  const [from, to] = dayBounds('2026-07-27');
  const t = dailyTotals(segmentsFor(markers, from, to, at(2026, 7, 27, 20)));
  assert.deepEqual(t.map((x) => x.activityId), ['jatek', 'etkezes'], 'hosszabb elöl');
  assert.equal(t[0].ms, 3.5 * 3600_000, 'a két játék-szakasz összeadódik');
  assert.equal(t[1].ms, 0.5 * 3600_000);
});

test('toTimeInput az input mezo alakjat adja', () => {
  assert.equal(toTimeInput(at(2026, 7, 27, 18, 25)), '18:25');
  assert.equal(toTimeInput(at(2026, 7, 27, 6, 5)), '06:05');
});

test('nextOf a szegmens VÉGÉT meghatározó markert adja', () => {
  const markers = [
    mk('a', at(2026, 7, 27, 8), 'jatek'),
    mk('b', at(2026, 7, 27, 9), 'etkezes'),
  ];
  assert.equal(nextOf(markers, 'a')?.id, 'b');
  assert.equal(nextOf(markers, 'b'), null, 'a futó szegmensnek nincs vége-markere');
});

test('usageScores a frissebb használatot súlyozza erősebben', () => {
  const now = at(2026, 7, 27, 12);
  const markers = [
    // "regi": 14 napja, ketszer -> 2 * 0.25 = 0.5
    mk('r1', now - 14 * 86400000, 'regi'),
    mk('r2', now - 14 * 86400000 + 1000, 'regi'),
    // "uj": ma egyszer -> ~1.0
    mk('u1', now - 3600000, 'uj'),
  ];
  const sc = usageScores(markers, now);
  assert.ok(sc.get('uj')! > sc.get('regi')!, 'egy mai használat többet ér két kéthetesnél');
});

test('rankedActivities a soha nem használtakat a kézi sorrendben hagyja', () => {
  const now = at(2026, 7, 27, 12);
  const acts: Activity[] = [
    { id: 'a', label: 'A', color: '#111111', icon: null, sort: 30, archived: false },
    { id: 'b', label: 'B', color: '#222222', icon: null, sort: 10, archived: false },
    { id: 'c', label: 'C', color: '#333333', icon: null, sort: 20, archived: false },
  ];
  const ranked = rankedActivities(acts, [mk('m', now - 3600000, 'a')], now);
  assert.deepEqual(ranked.map((x) => x.id), ['a', 'b', 'c'], 'a használt elöl, a többi sort szerint');
});

test('timeInLogicalDay a MEGJELENÍTETT naphoz horgonyoz, éjfélen át is', () => {
  // A 2026-07-27 logikai nap 07-27 04:00-tól 07-28 04:00-ig tart.
  const [from] = dayBounds('2026-07-27');
  // Késő esti időpont -> ugyanaz a naptári nap.
  assert.equal(timeInLogicalDay(from, '23:00'), at(2026, 7, 27, 23, 0));
  // Hajnali időpont -> a KÖVETKEZŐ naptári nap, de UGYANAZ a logikai nap.
  assert.equal(timeInLogicalDay(from, '02:00'), at(2026, 7, 28, 2, 0));
  // Az eredmény mindig a napon BELÜL van.
  const [f, t] = dayBounds('2026-07-27');
  for (const hhmm of ['04:00', '12:30', '23:59', '00:15', '03:59']) {
    const x = timeInLogicalDay(f, hhmm);
    assert.ok(x >= f && x < t, `${hhmm} kiesett a napból`);
  }
});

test('a "Vége" határ törlése a markert dobja el, nem no-op', () => {
  // Ez a Day.clearSegment ága: ha a marker MÁR __none__, a __none__-ra állítás
  // nem csinálna semmit — a felhasználó ezt látta úgy, hogy "nem hat rá a
  // törlés gomb". A helyes viselkedés a határ eldobása, amitől az előző
  // tevékenység folytatódik.
  const markers = [
    mk('alvas', at(2026, 7, 27, 22, 45), 'alvas'),
    mk('vege', at(2026, 7, 27, 22, 51), NONE),
  ];
  const [from, to] = dayBounds('2026-07-27');
  const most = at(2026, 7, 27, 23, 12);

  // A "Vége" előtt: az alvás 22:45-22:51.
  const elotte = segmentsFor(markers, from, to, most);
  assert.equal(elotte.at(-1)!.end, at(2026, 7, 27, 22, 51));

  // A határ eldobása után az alvás a JELENIG tart.
  const utana = segmentsFor(markers.filter((m) => m.id !== 'vege'), from, to, most);
  assert.equal(utana.at(-1)!.end, most, 'a lezárás eldobásával a szegmens folytatódik');
});

test('a vég szerkesztése a VÉG-marker napjához horgonyoz (átéjszakázó szegmens)', () => {
  // Alvás 22:00 -> másnap 07:00. A kezdő marker a 07-27-i logikai naphoz
  // tartozik, a vég-marker viszont naptárilag már 07-28. Ha a véget a KEZDŐ
  // napjából számolnánk, a 08:00 a kezdés ELÉ esne, és a korlát ~1 ms-ra
  // omlasztaná a szegmenst.
  const kezdet = at(2026, 7, 27, 22, 0);
  const veg = at(2026, 7, 28, 7, 0);

  const rosszul = retimeMarker(kezdet, '08:00');
  assert.ok(rosszul < kezdet, 'a kezdő napjából számolva tényleg a kezdés elé esne');

  const helyesen = retimeMarker(veg, '08:00');
  assert.equal(helyesen, at(2026, 7, 28, 8, 0));
  assert.ok(helyesen > kezdet, 'a vég-marker napjából számolva helyes');
});

test('wallClockPct a FALIÓRÁHOZ igazít, óraátállításkor is', () => {
  // Normál nap: 04:00 -> 0%, 16:00 -> 50%, a nap vége -> 100%.
  const [f1, t1] = dayBounds('2026-07-27');
  assert.equal(wallClockPct(f1, t1), 0);
  assert.equal(wallClockPct(at(2026, 7, 27, 16, 0), t1), 50);
  assert.equal(wallClockPct(t1, t1), 100);

  // Tavaszi óraátállítás napja: a logikai nap 23 órás, a 16:00 MÉGIS
  // ugyanoda esik, mint bármely más napon.
  const [f2, t2] = dayBounds('2026-03-28');
  const hossz = (t2 - f2) / 3600_000;
  assert.equal(wallClockPct(at(2026, 3, 28, 16, 0), t2), 50, `naphossz: ${hossz} óra`);

  const [f3, t3] = dayBounds('2026-03-29');
  assert.equal(wallClockPct(at(2026, 3, 29, 16, 0), t3), 50);
});

test('a szegmens szélessége az őszi óraátállításnál sem lehet negatív', () => {
  // Ősszel egy óra MEGISMÉTLŐDIK, ezért egy későbbi időpont faliórája
  // korábbi lehet — a puszta százalék-különbség negatív lenne, és a
  // szegmens eltűnne a nézetből.
  const [f, t] = dayBounds('2026-10-25');
  const start = f + 22 * 3600_000; // jóval a nap belsejében
  const end = start + 45 * 60_000;
  const w = segmentWidthPct(start, end, wallClockPct(start, t));
  assert.ok(w > 0, 'pozitív szélesség');
  assert.ok(w <= 100 - wallClockPct(start, t) + 0.001, 'nem lóg ki a sávból');

  // Mesterségesen visszafelé menő faliórára is nemnegatív marad.
  assert.equal(segmentWidthPct(1000, 900, 50), 0);
});

test('az őszi ismétlődő órában a marker saját előfordulása marad', () => {
  // Normál napon semmi nem változik: az átírás pontosan a kért időt adja.
  const at = new Date(2026, 6, 10, 14, 0).getTime();
  assert.equal(toTimeInput(retimeMarker(at, '15:20')), '15:20');
  assert.equal(retimeMarker(at, '15:20'), new Date(2026, 6, 10, 15, 20).getTime());

  // 2026-10-25: 03:00 CEST -> 02:00 CET, a 02:00–03:00 óra megismétlődik.
  const first0230 = new Date(2026, 9, 25, 2, 30).getTime();
  const second0230 = first0230 + 3_600_000;
  // Ha tényleg van ismétlődő óra ebben a zónában, a két időbélyeg fali órája
  // azonos — különben a teszt zónafüggetlenül is értelmes marad.
  if (toTimeInput(second0230) === '02:30') {
    const moved = retimeMarker(second0230, '02:45');
    assert.equal(toTimeInput(moved), '02:45');
    assert.ok(moved > second0230, 'a MÁSODIK 02:45-re megy, nem ugrik vissza');
    // Az elsőé viszont marad az első.
    assert.ok(retimeMarker(first0230, '02:45') < second0230);
  }
});
