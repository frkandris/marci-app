/**
 * A store hálózati viselkedése. A `fetch`-et kicseréljük, hogy a válaszok
 * sorrendjét mi diktáljuk — épp ez az, ami valós hálózaton nem garantált.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

interface Call {
  path: string;
  body: unknown;
  resolve: (v: unknown) => void;
}

/** Friss store-példány minden teszthez, felügyelt fetch-csel. */
async function harness() {
  const calls: Call[] = [];
  // A store betöltéskor olvassa a mentett tokent; böngészőn kívül nincs ilyen.
  const mem = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  };
  (globalThis as { fetch?: unknown }).fetch = (input: string, init?: RequestInit) =>
    new Promise((res) => {
      calls.push({
        path: String(input),
        body: init?.body ? JSON.parse(String(init.body)) : null,
        resolve: (v) =>
          res(new Response(v === null ? null : JSON.stringify(v), { status: v === null ? 204 : 200 })),
      });
    });
  const store = await import(`../src/store.ts?t=${Math.random()}`);
  return { calls, store };
}

test('ugyanarra a markerre a kérések SOROSAN mennek ki', async () => {
  const { calls, store } = await harness();

  const first = store.updateMarker('m1', { at: 1000 });
  const second = store.updateMarker('m1', { at: 2000 });
  await new Promise((r) => setTimeout(r, 0));

  assert.equal(calls.length, 1, 'a második kérés MEG SEM indult, amíg az első fut');
  assert.equal(calls[0].body.at, 1000);

  calls[0].resolve({ id: 'm1', at: 1000, activityId: '__none__', note: null });
  await first;
  await new Promise((r) => setTimeout(r, 0));

  assert.equal(calls.length, 2, 'az első lezárultával indul a második');
  assert.equal(calls[1].body.at, 2000);
  calls[1].resolve({ id: 'm1', at: 2000, activityId: '__none__', note: null });
  await second;

  // A szerveren a felhasználó UTOLSÓ szándéka maradt, és a helyi kép is ez.
  assert.equal(store.getState().markers.find((m) => m.id === 'm1')?.at, 2000);
});

test('kulonbozo markerek tovabbra is parhuzamosak', async () => {
  const { calls, store } = await harness();
  void store.updateMarker('a', { at: 1 });
  void store.updateMarker('b', { at: 2 });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(calls.length, 2, 'egymást nem várják meg');
  calls.forEach((c, i) => c.resolve({ id: ['a', 'b'][i], at: i + 1, activityId: '__none__', note: null }));
});

test('egy elbukott keres nem akasztja meg a sorban mogotte allot', async () => {
  const { calls, store } = await harness();
  const first = store.updateMarker('m1', { at: 1 });
  await new Promise((r) => setTimeout(r, 0));
  calls[0].resolve(undefined); // 200, de érvénytelen törzs -> hiba
  await first;
  const second = store.updateMarker('m1', { at: 2 });
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(calls.length >= 2, 'a következő elindult');
  calls[calls.length - 1].resolve({ id: 'm1', at: 2, activityId: '__none__', note: null });
  await second;
});
