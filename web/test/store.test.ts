/**
 * A store hálózati viselkedése. A `fetch`-et kicseréljük, hogy a válaszok
 * sorrendjét mi diktáljuk — épp ez az, ami valós hálózaton nem garantált.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

interface Call {
  path: string;
  body: unknown;
  resolve: (v: unknown, status?: number) => void;
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
        resolve: (v, status) =>
          res(
            new Response(v === null || v === undefined ? null : JSON.stringify(v), {
              status: status ?? (v === null ? 204 : 200),
            }),
          ),
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

test('a sikeres modositas a MENTETT sorral ter vissza', async () => {
  // A hívó ebből tudja, hogy felajánlhatja a visszavonást. Ha `undefined`-ot
  // kapna, a sikeres húzás után sosem jelenne meg a "Visszavonás".
  const { calls, store } = await harness();
  const p = store.updateMarker('m1', { at: 5 });
  await new Promise((r) => setTimeout(r, 0));
  calls[0].resolve({ id: 'm1', at: 5, activityId: '__none__', note: null });
  const saved = await p;
  assert.ok(saved, 'nem null és nem undefined');
  assert.equal(saved.at, 5);
});

test('egy elavult 401 nem rantja vissza a jelszokaput', async () => {
  const { calls, store } = await harness();
  const p = store.updateMarker('m1', { at: 5 });
  await new Promise((r) => setTimeout(r, 0));

  // A felhasználó közben beírja a jelszót...
  store.setToken('titok');
  assert.equal(store.getState().needsToken, false);

  // ...és csak EZUTÁN fut be a régi kérés 401-e.
  calls[0].resolve({ error: 'unauthorized' }, 401);
  await p;
  assert.equal(store.getState().needsToken, false, 'a kapu nem jött vissza');

  // Az új tokennel érkező 401 viszont igenis kapuhoz terel.
  const p2 = store.updateMarker('m2', { at: 6 });
  await new Promise((r) => setTimeout(r, 0));
  calls[calls.length - 1].resolve({ error: 'unauthorized' }, 401);
  await p2;
  assert.equal(store.getState().needsToken, true);
});
