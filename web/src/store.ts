/**
 * Vékony REST-kliens. A szerver az EGYETLEN igazságforrás: nincs lokális tár,
 * nincs dirty flag, nincs ütközésfeloldás.
 * Lásd wiki/decisions/2026-07-27-online-only.md.
 */
import { dayBounds, dayKey, shiftDayKey, type Activity, type Marker } from './model';

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

export async function refresh(days = state.daysLoaded) {
  const gen = ++refreshGen;
  set({ loading: true });
  try {
    const [from, to] = window_(days);
    const [markers, activities] = await Promise.all([
      api<Marker[]>(`/markers?from=${from}&to=${to}`),
      api<Activity[]>('/activities'),
    ]);
    if (gen !== refreshGen) return; // közben újabb lekérés indult — ez elavult
    set({ markers, activities, daysLoaded: days, error: null, ready: true });
  } catch (e) {
    // Mindig online az elvárás, de a hálózat akkor is elmehet — ilyenkor a
    // korábban betöltött adat a képernyőn marad, és jelezzük, hogy elavult.
    if (gen !== refreshGen) return;
    set({ error: `Nem érhető el a szerver (${(e as Error).message})` });
    set({ ready: true });
  } finally {
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
  try {
    return await fn();
  } catch (e) {
    set({ error: `Nem sikerült menteni: ${(e as Error).message}` });
    return null;
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

/** A mentett sorral tér vissza, hogy a hívó azonnal el tudja indítani. */
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

export const archiveActivity = (id: string) =>
  guard(async () => {
    await api<void>(`/activities/${encodeURIComponent(id)}`, { method: 'DELETE' });
    set({
      activities: state.activities.map((a) => (a.id === id ? { ...a, archived: true } : a)),
      error: null,
    });
  });

export const unarchiveActivity = (a: Activity) => saveActivity({ ...a, archived: false });

/**
 * Végleges törlés. `cascade` nélkül a szerver 409-cel elutasítja, ha markerek
 * hivatkoznak rá — így nem lehet véletlenül árva adatot csinálni.
 * Visszatérés: `null` ha sikerült, különben a használatok száma.
 */
export async function deleteActivityHard(id: string, cascade = false): Promise<number | null> {
  const q = `?hard=1${cascade ? '&cascade=1' : ''}`;
  const res = await authFetch(`/activities/${encodeURIComponent(id)}${q}`, { method: 'DELETE' });
  if (res.status === 409) return (await res.json()).usage ?? 0;
  if (!res.ok) {
    set({ error: `Nem sikerült törölni (${res.status})` });
    return 0;
  }
  set({
    activities: state.activities.filter((a) => a.id !== id),
    // A hivatkozó markerek is eltűntek a szerveren, tehát lokálisan is.
    markers: cascade ? state.markers.filter((m) => m.activityId !== id) : state.markers,
    error: null,
  });
  return null;
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

export function init() {
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
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void refresh();
      start();
    } else {
      stop();
    }
  });
  window.addEventListener('online', () => void refresh());
  if (document.visibilityState === 'visible') start();
}
