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
  assert.equal(res.status, 200, 'a /api/health SOHA nem kérhet tokent');
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
