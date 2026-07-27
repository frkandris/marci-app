/**
 * A határjelölő adatmodell származtatott logikája.
 * Lásd wiki/decisions/2026-07-27-hatarjelolo-adatmodell.md és
 *      wiki/decisions/2026-07-27-logikai-napkezdet.md
 */

/** Pszeudo-tevékenység: "innentől nincs rögzítés". Lezár egy szegmenst anélkül, hogy újat nyitna. */
export const NONE = '__none__';

/** A logikai nap 04:00-kor kezdődik, hogy az éjszakai alvás egyben maradjon. */
export const DAY_START_HOUR = 4;

export interface Marker {
  id: string;
  at: number;
  activityId: string;
  note: string | null;
}

export interface Activity {
  id: string;
  label: string;
  color: string;
  icon: string | null;
  sort: number;
  /** Archivált típus eltűnik a gombok közül, de a régi szegmensek megmaradnak. */
  archived: boolean;
  /** Hány marker hivatkozik rá. A törlés/archiválás eldöntéséhez. */
  usageCount?: number;
}

export interface Segment {
  start: number;
  end: number;
  activityId: string;
  markerId: string;
  /** A szegmens a nap határán túlnyúlik — a megjelenített hossz nem a valódi hossz. */
  clippedStart: boolean;
  clippedEnd: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

const fmtKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Melyik logikai naphoz tartozik egy időpont. Helyi idő szerint.
 *
 * NAPTÁRI aritmetika, nem `at - 4 óra`. Az abszolút kivonás a nyári időszámítás
 * váltásakor elromlik: 2026-03-29 04:30-ból 2026-03-28 23:30 lenne, vagyis az új
 * logikai nap első órája az ELŐZŐ naphoz kerülne — miközben a `dayBounds` szerint
 * nem is esik bele. A kettő így ellentmondana egymásnak.
 */
export function dayKey(at: number, hour = DAY_START_HOUR): string {
  const d = new Date(at);
  if (d.getHours() < hour) d.setDate(d.getDate() - 1);
  return fmtKey(d);
}

/**
 * Egy logikai nap kezdete epoch ms-ben.
 * Szándékosan `new Date(y, m, d, hour)` — így a nyári időszámítás váltása
 * helyesen 23 vagy 25 órás napot ad, nem csúszik el a rács.
 */
export function dayStartMs(key: string, hour = DAY_START_HOUR): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, hour, 0, 0, 0).getTime();
}

export function shiftDayKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return fmtKey(new Date(y, m - 1, d + days));
}

/**
 * Ugyanaz a helyi óra:perc az előző naptári napon.
 * Naptári léptetés, nem −24 óra: a tavaszi óraátállítás napján a −86 400 000 ms
 * egy órával elcsúsztatná a kért időpontot.
 */
export function sameClockPreviousDay(t: number): number {
  const d = new Date(t);
  d.setDate(d.getDate() - 1);
  return d.getTime();
}

export function dayBounds(key: string, hour = DAY_START_HOUR): [number, number] {
  return [dayStartMs(key, hour), dayStartMs(shiftDayKey(key, 1), hour)];
}

export const activeMarkers = (all: Marker[]): Marker[] =>
  [...all].sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

export const liveActivities = (all: Activity[]): Activity[] =>
  all.filter((a) => !a.archived).sort((a, b) => a.sort - b.sort);

/**
 * A `[from, to)` intervallumra eső szegmensek.
 *
 * A carry-in a modell legkönnyebben elrontható pontja: a nap első szegmensét
 * szinte mindig egy ELŐZŐ napi marker definiálja (az esti alvás). Ezért indul
 * a bejárás a `from` előtti utolsó markertől, nem a napon belüli elsőtől.
 */
export function segmentsFor(all: Marker[], from: number, to: number, now: number): Segment[] {
  const ms = activeMarkers(all);
  const out: Segment[] = [];

  let i = 0;
  while (i < ms.length && ms[i].at <= from) i++;
  const startIdx = i > 0 ? i - 1 : 0;

  for (let j = startIdx; j < ms.length; j++) {
    const m = ms[j];
    if (m.at >= to) break;
    const rawEnd = ms[j + 1] ? ms[j + 1].at : now;
    const start = Math.max(m.at, from);
    // A `now` felső korlát MINDEN szegmensre vonatkozik, nem csak az utolsóra:
    // egy jövőbeli marker különben a mögötte lévő szegmenst a jövőbe nyújtaná,
    // vagyis még el nem telt időt mutatnánk megtörténtként.
    const end = Math.min(rawEnd, to, now);
    if (end <= start) continue;
    if (m.activityId === NONE) continue;
    out.push({
      start,
      end,
      activityId: m.activityId,
      markerId: m.id,
      clippedStart: m.at < from,
      clippedEnd: rawEnd > to,
    });
  }
  return out;
}

/** A `[from, to)`-ba eső markerek — ezek fogantyúi húzhatók az idővonalon. */
export function markersIn(all: Marker[], from: number, to: number): Marker[] {
  return activeMarkers(all).filter((m) => m.at >= from && m.at < to);
}

/**
 * Meddig húzható egy marker: szigorúan a két szomszédja közé.
 * Így nem tolja maga előtt a többit, és nem keletkezhet nulla hosszú szegmens.
 */
export function dragBounds(all: Marker[], markerId: string): [number, number] {
  const ms = activeMarkers(all);
  const i = ms.findIndex((m) => m.id === markerId);
  if (i < 0) return [-Infinity, Infinity];
  return [ms[i - 1] ? ms[i - 1].at + 1 : -Infinity, ms[i + 1] ? ms[i + 1].at - 1 : Infinity];
}

/**
 * A jelenleg futó tevékenység: az utolsó olyan marker, ami MÁR elkezdődött.
 *
 * A `now` szűrés nem elméleti: egy elgépelt visszamenőleges rögzítés jövőbeli
 * markert hoz létre, és enélkül az válna „futóvá" — a stopper 0:00-t mutatna,
 * a képernyő pedig egy még meg sem történt tevékenységet.
 */
export function runningMarker(all: Marker[], now = Date.now()): Marker | null {
  const started = activeMarkers(all).filter((m) => m.at <= now);
  const last = started[started.length - 1];
  if (!last || last.activityId === NONE) return null;
  return last;
}

/**
 * Az adott marker ELŐTTI marker. A „mégis, folytasd az előzőt" művelethez kell:
 * a futó marker törlésével a megelőző szegmens automatikusan folytatódik.
 */
export function previousOf(all: Marker[], id: string): Marker | null {
  const ms = activeMarkers(all);
  const i = ms.findIndex((m) => m.id === id);
  return i > 0 ? ms[i - 1] : null;
}

/** Tevékenységenkénti összeg egy napra, hossz szerint csökkenő sorrendben. */
export function dailyTotals(segments: Segment[]): Array<{ activityId: string; ms: number }> {
  const by = new Map<string, number>();
  for (const s of segments) by.set(s.activityId, (by.get(s.activityId) ?? 0) + (s.end - s.start));
  return [...by.entries()]
    .map(([activityId, ms]) => ({ activityId, ms }))
    .sort((a, b) => b.ms - a.ms);
}

/**
 * A `HH:MM` időpont a MEGJELENÍTETT logikai napon belül.
 *
 * Nem elég a marker naptári napját megtartani: a logikai nap 04:00-tól
 * 04:00-ig tart, tehát egy 02:00-s marker naptárilag már a KÖVETKEZŐ napon
 * van. Ha ilyenkor 23:00-ra írnánk át a naptári napot megtartva, az esemény
 * egy nappal odébb kerülne — eltűnne a nézetből, vagy a jövőbe csúszna.
 *
 * @param dayFrom a logikai nap kezdete (a `dayBounds` első eleme)
 */
export function timeInLogicalDay(dayFrom: number, hhmm: string, hour = DAY_START_HOUR): number {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(dayFrom);
  // A napkezdet előtti órák a KÖVETKEZŐ naptári napra esnek.
  if (h < hour) d.setDate(d.getDate() + 1);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

/**
 * Új óra:perc a marker SAJÁT logikai napján belül.
 *
 * Nem a megjelenített napot vesszük alapul: egy carry-in marker (pl. tegnap
 * 22:00-s alvás, ami átnyúlik a mai napra) az ELŐZŐ logikai naphoz tartozik.
 * A megjelenített naphoz horgonyozva 21:00-ból ma 21:00 lenne, amit a
 * szomszéd-korlát visszavágna — elrontva a kezdést.
 */
export function retimeMarker(at: number, hhmm: string, hour = DAY_START_HOUR): number {
  return timeInLogicalDay(dayStartMs(dayKey(at, hour), hour), hhmm, hour);
}

/** Az `<input type="time">` által várt alak. */
export function toTimeInput(at: number): string {
  const d = new Date(at);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Az adott marker UTÁNI marker — ez határozza meg a szegmens VÉGÉT. */
export function nextOf(all: Marker[], id: string): Marker | null {
  const ms = activeMarkers(all);
  const i = ms.findIndex((m) => m.id === id);
  return i >= 0 && i < ms.length - 1 ? ms[i + 1] : null;
}

/** Felezési idő a használati pontszámban: egy hete használt fele annyit ér. */
const SCORE_HALFLIFE_DAYS = 7;

/**
 * Tevékenységenkénti használati pontszám: gyakoriság, frissességgel súlyozva.
 * Egy exponenciális lecsengés egyszerre fejezi ki a „gyakran" és a „legutóbb"
 * szempontot — nem kell két külön rendezés.
 */
export function usageScores(markers: Marker[], now = Date.now()): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of markers) {
    if (m.activityId === NONE) continue;
    const ageDays = (now - m.at) / 86_400_000;
    if (ageDays < 0) continue;
    const w = Math.pow(0.5, ageDays / SCORE_HALFLIFE_DAYS);
    out.set(m.activityId, (out.get(m.activityId) ?? 0) + w);
  }
  return out;
}

/**
 * Használat szerint rendezett tevékenységek. A soha nem használtak a kézi
 * `sort` sorrendjükben követik őket, hogy egy új típus se essen a lista aljára
 * véletlenszerűen.
 */
export function rankedActivities(
  activities: Activity[],
  markers: Marker[],
  now = Date.now(),
): Activity[] {
  const score = usageScores(markers, now);
  return [...activities].sort((a, b) => {
    const d = (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0);
    return d !== 0 ? d : a.sort - b.sort;
  });
}

/**
 * Egy időpont helye a napi sávon, 0–100 között — FALIÓRA szerint.
 *
 * Nem az eltelt idő arányából számolunk, mert az óraátállítás napján a logikai
 * nap 23 vagy 25 órás: a sor ilyenkor elcsúszna a közös óratengelyhez képest,
 * és pont az veszne el, amiért a többnapos nézet létezik — a napok
 * összehasonlíthatósága. A faliórás pozíció minden sorban ugyanoda teszi a
 * 08:00-t, akkor is, ha aznap egy óra kimaradt vagy megismétlődött.
 */
export function wallClockPct(t: number, dayEnd: number, hour = DAY_START_HOUR): number {
  if (t >= dayEnd) return 100;
  const d = new Date(t);
  let h = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600 - hour;
  if (h < 0) h += 24;
  return (h / 24) * 100;
}

export const SNAP_MS = 5 * 60_000;
export const snap = (t: number, grid = SNAP_MS) => Math.round(t / grid) * grid;

const hhmm = new Intl.DateTimeFormat('hu-HU', { hour: '2-digit', minute: '2-digit' });
export const fmtTime = (t: number) => hhmm.format(new Date(t));

export function fmtDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h} ó ${m} p` : `${m} p`;
}

export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

const dayFmt = new Intl.DateTimeFormat('hu-HU', { month: 'short', day: 'numeric' });
const dayFmtLong = new Intl.DateTimeFormat('hu-HU', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
});
export const fmtDay = (key: string) => dayFmt.format(new Date(dayStartMs(key) + 12 * 3600_000));
export const fmtDayLong = (key: string) =>
  dayFmtLong.format(new Date(dayStartMs(key) + 12 * 3600_000));
