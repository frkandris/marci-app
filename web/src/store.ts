/**
 * Vékony REST-kliens. A szerver az EGYETLEN igazságforrás: nincs lokális tár,
 * nincs dirty flag, nincs ütközésfeloldás.
 * Lásd wiki/decisions/2026-07-27-online-only.md.
 */
import { NONE, dayBounds, dayKey, shiftDayKey, type Activity, type Marker } from './model';

/** Hány napra visszamenőleg töltünk be egyszerre. A Napok nézet ezt bővíti. */
const INITIAL_DAYS = 45;
/** A másik telefon változásai ennyi időn belül jelennek meg. */
const POLL_MS = 30_000;

const TOKEN_KEY = 'marci-token';
let token = localStorage.getItem(TOKEN_KEY) ?? '';

export interface State {
  ready: boolean;
  /** A szerver tokent kér, de nincs (vagy rossz) — beviteli képernyő kell. */
  needsToken: boolean;
  markers: Marker[];
  activities: Activity[];
  daysLoaded: number;
  loading: boolean;
  error: string | null;
  /** A service worker új verziót töltött le, és vár a beélesítésre. */
  updateReady: boolean;
}

let state: State = {
  ready: false,
  needsToken: false,
  markers: [],
  activities: [],
  daysLoaded: INITIAL_DAYS,
  loading: false,
  error: null,
  updateReady: false,
};

const listeners = new Set<() => void>();
export const subscribe = (fn: () => void) => (listeners.add(fn), () => void listeners.delete(fn));
export const getState = () => state;
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((f) => f());
};

/** MINDEN kérés ezen megy át — enélkül bekapcsolt SHARED_TOKEN mellett 401. */
const authFetch = (path: string, init?: RequestInit) =>
  fetch(`/api${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { 'X-Marci-Token': token } : {}),
    },
  });

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(path, init);
  if (res.status === 401) {
    set({ needsToken: true, ready: true });
    throw new Error('unauthorized');
  }
  if (!res.ok) {
    let detail = String(res.status);
    try {
      detail = (await res.json()).error ?? detail;
    } catch {
      /* nem JSON */
    }
    throw new Error(detail);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

/** A betöltött ablak: `daysLoaded` nappal ezelőttől a holnapi nap kezdetéig. */
function window_(days = state.daysLoaded): [number, number] {
  const today = dayKey(Date.now());
  return [dayBounds(shiftDayKey(today, -(days - 1)))[0], dayBounds(shiftDayKey(today, 1))[1]];
}

/**
 * Generációszámláló a versenyhelyzet ellen: ha a poll és egy loadMoreDays
 * átfedi egymást, a KÉSŐBB BEFEJEZŐDŐ írná felül a másikat — akkor is, ha ő
 * indult előbb. Egy lassú 45 napos poll így eldobhatna egy kész 75 naposat,
 * vagy eltüntethetne egy épp mentett markert.
 */
let refreshGen = 0;
let replacementQueued = false;
/** Hány lekérés fut épp. Ebből tudjuk, KI tette elavulttá a miénket. */
let refreshInFlight = 0;

/**
 * Egy elavulttá vált lekérés pótlása.
 *
 * CSAK akkor szabad pótolni, ha rajtunk kívül nem fut másik lekérés — vagyis
 * az elavulást egy MUTÁCIÓ okozta. Ha egy újabb lekérés miatt lettünk
 * elavultak, az fog állapotot írni; ilyenkor pótolni öngerjesztő láncot
 * indítana (a pótlás elavulttá tenné a futó újat, az megint pótolna…), és a
 * `loading` sosem tisztulna le.
 */
function queueReplacementRefresh() {
  if (replacementQueued) return;
  replacementQueued = true;
  setTimeout(() => {
    replacementQueued = false;
    void refresh();
  }, 0);
}

export async function refresh(days = state.daysLoaded) {
  const gen = ++refreshGen;
  refreshInFlight++;
  // A kért ablakot AZONNAL rögzítjük. Ha ezt a lekérést egy mutáció eldobja,
  // a következő poll már a szélesebb ablakot kéri — különben egy régebbi nap
  // tartósan hiányos maradna.
  set({ loading: true, daysLoaded: Math.max(days, state.daysLoaded) });
  try {
    const [from, to] = window_(days);
    const [markers, activities] = await Promise.all([
      api<Marker[]>(`/markers?from=${from}&to=${to}`),
      api<Activity[]>('/activities'),
    ]);
    if (gen !== refreshGen) {
      // Csak akkor pótolunk, ha egyedül futunk — különben egy újabb lekérés
      // tett elavulttá, és az úgyis ír állapotot.
      if (refreshInFlight === 1) queueReplacementRefresh();
      return;
    }
    set({ markers, activities, daysLoaded: days, error: null, ready: true });
  } catch (e) {
    // Mindig online az elvárás, de a hálózat akkor is elmehet — ilyenkor a
    // korábban betöltött adat a képernyőn marad, és jelezzük, hogy elavult.
    if (gen !== refreshGen) {
      if (refreshInFlight === 1) queueReplacementRefresh();
      return;
    }
    set({ error: `Nem érhető el a szerver (${(e as Error).message})` });
    set({ ready: true });
  } finally {
    refreshInFlight--;
    if (gen === refreshGen) set({ loading: false });
  }
}

export const loadMoreDays = (extra = 30) => refresh(state.daysLoaded + extra);

/**
 * A Nap nézet korlátlanul lapozható visszafelé, a betöltött ablak viszont
 * véges. Enélkül a régebbi napok ÜRESNEK látszanának, pedig a szerveren
 * megvannak — ami adatvesztésnek tűnik.
 */
export async function ensureDayLoaded(key: string) {
  const [dayFrom] = dayBounds(key);
  const [winFrom] = window_();
  if (dayFrom >= winFrom) return;
  const needed = Math.ceil((Date.now() - dayFrom) / 86_400_000) + 2;
  await refresh(Math.max(needed, state.daysLoaded));
}

// --- műveletek ------------------------------------------------------------
// A végpontok visszaadják a mentett sort, ezt írjuk vissza az állapotba.
// Így nincs teljes újratöltés minden húzás után.

const upsertLocal = (row: Marker) =>
  set({
    markers: state.markers.some((m) => m.id === row.id)
      ? state.markers.map((m) => (m.id === row.id ? row : m))
      : [...state.markers, row],
    error: null,
  });

async function guard<T>(fn: () => Promise<T>): Promise<T | null> {
  // Minden mutáció ELAVULTTÁ tesz minden folyamatban lévő lekérést. Enélkül
  // egy korábban indult poll a régi pillanatképével felülírná a friss
  // változtatást — a törölt szegmens visszajönne, az új eltűnne. Ez okozta,
  // hogy a Törlés gomb néha "nem hatott".
  refreshGen++;
  try {
    return await fn();
  } catch (e) {
    set({ error: `Nem sikerült menteni: ${(e as Error).message}` });
    return null;
  } finally {
    // A mutáció KÖZBEN indult lekérés a mutáció ELŐTTI állapotot olvasta, de
    // frissebb generációt kapott — ezért a végén ÚJRA érvénytelenítünk.
    refreshGen++;
  }
}

/** A létrehozott sorral tér vissza, hogy a felület visszavonást tudjon kínálni. */
export const addMarker = (activityId: string, at = Date.now(), note: string | null = null) =>
  guard(async () => {
    const row = await api<Marker>('/markers', {
      method: 'POST',
      body: JSON.stringify({ at, activityId, note }),
    });
    upsertLocal(row);
    return row;
  });

export const updateMarker = (id: string, patch: Partial<Marker>) =>
  guard(async () =>
    upsertLocal(
      await api<Marker>(`/markers/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    ),
  );

export const deleteMarker = (id: string) =>
  guard(async () => {
    await api<void>(`/markers/${encodeURIComponent(id)}`, { method: 'DELETE' });
    set({ markers: state.markers.filter((m) => m.id !== id), error: null });
  });

/**
 * Új tevékenység. Az azonosítót a SZERVER osztja ki — a kliens nem tud
 * ütközésmentes id-t választani, mert a másik telefon listája is változhat.
 */
export const createActivity = (a: Omit<Activity, 'id' | 'archived'>) =>
  guard(async () => {
    const row = await api<Activity>('/activities', {
      method: 'POST',
      body: JSON.stringify(a),
    });
    set({ activities: [...state.activities, { ...row, usageCount: 0 }], error: null });
    return row;
  });

/** MEGLÉVŐ tevékenység módosítása. A mentett sorral tér vissza. */
export const saveActivity = (a: Activity) =>
  guard(async () => {
    const row = await api<Activity>(`/activities/${encodeURIComponent(a.id)}`, {
      method: 'PUT',
      body: JSON.stringify(a),
    });
    // A szerver visszaadja a usageCount-ot; ha valamiért mégsem, a korábbi
    // értéket tartjuk meg, különben a lista átmenetileg "0 esemény"-t írna.
    const prev = state.activities.find((x) => x.id === row.id);
    const merged = { ...row, usageCount: row.usageCount ?? prev?.usageCount ?? 0 };
    set({
      activities: state.activities.some((x) => x.id === merged.id)
        ? state.activities.map((x) => (x.id === merged.id ? merged : x))
        : [...state.activities, merged],
      error: null,
    });
    return merged;
  });

/**
 * Végleges törlés. `cascade` nélkül a szerver 409-cel elutasítja, ha markerek
 * hivatkoznak rá — így nem lehet véletlenül árva adatot csinálni.
 *
 * Visszatérés:
 *  - `'deleted'` — sikerült,
 *  - szám — használatban van, ennyi eseménnyel (megerősítés kell),
 *  - `'error'` — hálózati vagy szerverhiba; a hibasáv már jelzi.
 *
 * A háromállapotú válasz nem szépészet: korábban a hibák is 0-t adtak vissza,
 * amit a hívó „0 használat"-nak olvasott, és a visszafordíthatatlan kaszkádolt
 * törlést ajánlotta fel egy egyszerű hálózati hiba után.
 */
export type HardDeleteResult = 'deleted' | 'error' | number;

export async function deleteActivityHard(id: string, cascade = false): Promise<HardDeleteResult> {
  // Ez a függvény nem a `guard`-on megy át, ezért itt kell érvénytelenítenünk
  // a folyamatban lévő lekéréseket — különben egy régi poll visszahozná a
  // törölt tevékenységet és a markereit.
  refreshGen++;
  const q = `?hard=1${cascade ? '&cascade=1' : ''}`;
  let res: Response;
  try {
    res = await authFetch(`/activities/${encodeURIComponent(id)}${q}`, { method: 'DELETE' });
  } catch (e) {
    refreshGen++;
    set({ error: `Nem sikerült törölni: ${(e as Error).message}` });
    return 'error';
  }
  refreshGen++;
  if (res.status === 409) return (await res.json().catch(() => ({}))).usage ?? 0;
  if (!res.ok) {
    set({ error: `Nem sikerült törölni (${res.status})` });
    return 'error';
  }
  set({
    activities: state.activities.filter((a) => a.id !== id),
    // A szerver a hivatkozó markereket `__none__`-ra váltja (nem dobja el),
    // hogy a sávok üresek legyenek, ne az előző tevékenységé.
    markers: cascade
      ? state.markers.map((m) => (m.activityId === id ? { ...m, activityId: NONE } : m))
      : state.markers,
    error: null,
  });
  return 'deleted';
}

export const reorderActivities = (ids: string[]) =>
  guard(async () => {
    const rows = await api<Activity[]>('/activities/reorder', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
    set({ activities: rows, error: null });
  });

/** A megosztott jelszó beállítása. Lásd wiki/decisions/2026-07-27-nincs-hitelesites.md. */
export function setToken(t: string) {
  token = t.trim();
  localStorage.setItem(TOKEN_KEY, token);
  set({ needsToken: false, error: null });
  void refresh();
}

// --- verziófrissítés ------------------------------------------------------
// A service worker jelez, az app pedig SAJÁT sávban kínálja fel — soha nem
// natív confirm()-mal, mert az blokkolja a renderert.

let applyUpdateFn: (() => void) | null = null;

export function setUpdateAvailable(apply: () => void) {
  applyUpdateFn = apply;
  set({ updateReady: true });
}

export const applyUpdate = () => applyUpdateFn?.();

// --- életciklus -----------------------------------------------------------

let initialized = false;

/** StrictMode-ban kétszer fut le, HMR-nél újra — ezért idempotens. */
export function init(): () => void {
  if (initialized) return () => {};
  initialized = true;

  void refresh();

  let timer: ReturnType<typeof setInterval> | null = null;
  const start = () => {
    if (!timer) timer = setInterval(() => void refresh(), POLL_MS);
  };
  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };

  // Háttérben nincs értelme kérdezgetni; előtérbe kerüléskor viszont azonnal
  // kell egy friss lekérés, mert a másik telefon közben írhatott.
  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      void refresh();
      start();
    } else {
      stop();
    }
  };
  const onOnline = () => void refresh();

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('online', onOnline);
  if (document.visibilityState === 'visible') start();

  return () => {
    stop();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('online', onOnline);
    initialized = false;
  };
}
