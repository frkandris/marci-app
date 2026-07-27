/**
 * Végpont-szintű tesztek az app.fetch-en keresztül — nem kell portot foglalni.
 * A DB_PATH és a SHARED_TOKEN env-ből jön, ezért minden auth-változat külön
 * gyerekfolyamatban fut (lásd alább).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

const load = async (env = {}) => {
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  process.env.DB_PATH = ':memory:';
  // Cache-busting query, hogy minden teszt friss modulpéldányt kapjon.
  const mod = await import(`../src/index.js?t=${Math.random()}`);
  return mod.app;
};

test('a healthcheck token nélkül is átmegy, bekapcsolt SHARED_TOKEN mellett is', async () => {
  // Ez a Docker HEALTHCHECK útja: nem küld fejlécet. Ha 401-et kapna, minden
  // hitelesített deploy egészségtelennek minősülne egy működő szerver mellett.
  const app = await load({ SHARED_TOKEN: 'titok' });
  const res = await app.fetch(new Request('http://x/api/health'));
  // NEM 200-at várunk: a /api/health szándékosan 503-at ad, ha a frontend
  // build hiányzik (tiszta checkoutban ez a normális). A lényeg, hogy
  // átengedte a hitelesítést — vagyis nem 401.
  assert.notEqual(res.status, 401, 'a /api/health SOHA nem kérhet tokent');
  assert.ok([200, 503].includes(res.status), `váratlan státusz: ${res.status}`);
});

test('bekapcsolt token mellett a többi végpont 401-et ad token nélkül', async () => {
  const app = await load({ SHARED_TOKEN: 'titok' });
  const res = await app.fetch(new Request('http://x/api/activities'));
  assert.equal(res.status, 401);

  const ok = await app.fetch(
    new Request('http://x/api/activities', { headers: { 'X-Marci-Token': 'titok' } }),
  );
  assert.equal(ok.status, 200, 'helyes tokennel átmegy');
});

test('a marker nem hivatkozhat nem létező tevékenységre', async () => {
  const app = await load({ SHARED_TOKEN: '' });
  const res = await app.fetch(
    new Request('http://x/api/markers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ at: Date.now(), activityId: 'nincs-ilyen' }),
    }),
  );
  assert.equal(res.status, 409, 'árva marker nem jöhet létre');

  const ok = await app.fetch(
    new Request('http://x/api/markers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ at: Date.now(), activityId: '__none__' }),
    }),
  );
  assert.equal(ok.status, 201, 'a __none__ pszeudotípus mindig érvényes');
});

test('ismeretlen /api útvonal JSON 404-et ad, nem HTML-t', async () => {
  const app = await load({ SHARED_TOKEN: '' });
  const res = await app.fetch(new Request('http://x/api/nincs-ilyen'));
  assert.equal(res.status, 404);
  assert.match(res.headers.get('content-type') ?? '', /application\/json/);
});

test('a letrehozas kulon vegpont, es a szerver osztja az azonositot', async () => {
  const app = await load({ SHARED_TOKEN: '' });
  const mk = (label) =>
    app.fetch(new Request('http://x/api/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, color: '#112233', icon: 'star', sort: 100 }),
    })).then((r) => r.json());

  // Ket telefon UGYANAZT a nevet kuldi be — nem irhatjak felul egymast.
  const a = await mk('Séta');          // a 'seta' mar letezik alapbol
  const b = await mk('Séta');
  assert.notEqual(a.id, b.id, 'kulon azonositot kapnak');
  assert.notEqual(a.id, 'program', 'a meglevo sort nem irjak felul');

  const acts = await app.fetch(new Request('http://x/api/activities')).then((r) => r.json());
  assert.equal(acts.filter((x) => x.label === 'Séta').length, 3, 'mindharom megmaradt');
});

test('a PUT csak MEGLEVO tevekenyseget modosit, nem hoz letre ujat', async () => {
  const app = await load({ SHARED_TOKEN: '' });
  const res = await app.fetch(new Request('http://x/api/activities/nincs-ilyen', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label: 'X', color: '#112233', sort: 1 }),
  }));
  assert.equal(res.status, 404);
});

test('a jovobe nem lehet rogziteni, de a siketo telefonora belefer', async () => {
  const app = await load({ SHARED_TOKEN: '' });
  const post = (at) =>
    app.fetch(new Request('http://x/api/markers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ at, activityId: '__none__' }),
    }));

  assert.equal((await post(Date.now() + 6 * 3600_000)).status, 400, 'holnap reggel: nem');
  // A ket telefon oraja nem a szerveret koveti. Szigoru ellenorzessel egy par
  // masodperccel sieto keszulek MINDEN rogzitest elbukna.
  const ok = await post(Date.now() + 30_000);
  assert.equal(ok.status, 201, 'fel perc oraelteres belefer');

  const id = (await ok.json()).id;
  const patched = await app.fetch(new Request(`http://x/api/markers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ at: Date.now() + 6 * 3600_000 }),
  }));
  assert.equal(patched.status, 400, 'a modositas sem vihet a jovobe');
});
