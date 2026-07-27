import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { serve } from '@hono/node-server';
import { Hono } from 'hono';

import {
  archiveActivity,
  createMarker,
  deleteActivity,
  deleteMarker,
  listActivities,
  listMarkers,
  openDb,
  reorderActivities,
  updateMarker,
  upsertActivity,
} from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT ?? 3000);
const DB_PATH = process.env.DB_PATH ?? './dev.db';
// Üresen hagyva az API nyílt — ez a jelenlegi, tudatos döntés.
// Lásd wiki/decisions/2026-07-27-nincs-hitelesites.md.
const SHARED_TOKEN = (process.env.SHARED_TOKEN ?? '').trim();
const WEB_DIST = resolve(__dirname, '../../web/dist');

const db = openDb(DB_PATH);
const app = new Hono();

app.use('*', async (c, next) => {
  await next();
  c.header('X-Robots-Tag', 'noindex, nofollow');
});

app.get('/robots.txt', (c) => c.text('User-agent: *\nDisallow: /\n'));

// --- API ------------------------------------------------------------------

const api = new Hono();

api.use('*', async (c, next) => {
  // A healthcheck MINDIG szabad: a Docker HEALTHCHECK nem küld fejlécet, tehát
  // bekapcsolt SHARED_TOKEN mellett minden ellenőrzés elbukna, és a deploy
  // meghiúsulna egy tökéletesen működő szerver mellett is.
  const open = c.req.path === '/health';
  if (!open && SHARED_TOKEN && c.req.header('X-Marci-Token') !== SHARED_TOKEN) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  await next();
});

api.get('/health', (c) => {
  // A frontend meglétét is nézi: a Docker build fázisa csendben elhasalhat
  // úgy, hogy a szerver elindul, de csak 404-et ad.
  const web = existsSync(join(WEB_DIST, 'index.html'));
  return c.json({ ok: web, web }, web ? 200 : 503);
});

api.get('/activities', (c) => c.json(listActivities(db)));

api.put('/activities/:id', async (c) => {
  const id = c.req.param('id');
  const b = await json(c);
  if (!b) return c.json({ error: 'bad json' }, 400);
  if (typeof b.label !== 'string' || !b.label.trim()) return c.json({ error: 'label' }, 400);
  if (typeof b.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(b.color))
    return c.json({ error: 'color' }, 400);
  if (!Number.isFinite(b.sort)) return c.json({ error: 'sort' }, 400);
  return c.json(
    upsertActivity(db, {
      id,
      label: b.label.trim(),
      color: b.color,
      icon: b.icon ?? null,
      sort: b.sort,
      archived: !!b.archived,
    }),
  );
});

api.post('/activities/reorder', async (c) => {
  const b = await json(c);
  if (!Array.isArray(b?.ids) || b.ids.some((x) => typeof x !== 'string')) {
    return c.json({ error: 'ids' }, 400);
  }
  return c.json(reorderActivities(db, b.ids));
});

api.delete('/activities/:id', (c) => {
  const id = c.req.param('id');
  const hard = c.req.query('hard') === '1';
  if (!hard) {
    archiveActivity(db, id);
    return c.body(null, 204);
  }
  const res = deleteActivity(db, id, { cascade: c.req.query('cascade') === '1' });
  // 409: használatban van, és nem kértek cascade-et. A válasz megmondja, hányszor.
  return res.deleted ? c.body(null, 204) : c.json({ error: 'in_use', usage: res.usage }, 409);
});

api.get('/markers', (c) => {
  const from = Number(c.req.query('from'));
  const to = Number(c.req.query('to'));
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
    return c.json({ error: 'bad from/to' }, 400);
  }
  return c.json(listMarkers(db, from, to));
});

api.post('/markers', async (c) => {
  const b = await json(c);
  if (!b) return c.json({ error: 'bad json' }, 400);
  if (!Number.isFinite(b.at)) return c.json({ error: 'at' }, 400);
  if (typeof b.activityId !== 'string' || !b.activityId)
    return c.json({ error: 'activityId' }, 400);
  const id = typeof b.id === 'string' && b.id ? b.id : crypto.randomUUID();
  return c.json(createMarker(db, { id, at: b.at, activityId: b.activityId, note: b.note ?? null }), 201);
});

api.patch('/markers/:id', async (c) => {
  const b = await json(c);
  if (!b) return c.json({ error: 'bad json' }, 400);
  if (b.at !== undefined && !Number.isFinite(b.at)) return c.json({ error: 'at' }, 400);
  if (b.activityId !== undefined && (typeof b.activityId !== 'string' || !b.activityId))
    return c.json({ error: 'activityId' }, 400);
  const row = updateMarker(db, c.req.param('id'), b);
  return row ? c.json(row) : c.json({ error: 'not found' }, 404);
});

api.delete('/markers/:id', (c) =>
  deleteMarker(db, c.req.param('id')) ? c.body(null, 204) : c.json({ error: 'not found' }, 404),
);

const json = async (c) => {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
};

// Ismeretlen /api útvonal JSON 404-et ad, NEM esik át az SPA-fallbackre.
// Enélkül az API-hibák index.html-t adnának 200-zal, ami a kliensen
// JSON-parse hibaként jelentkezik — megtévesztő hibakép.
api.all('*', (c) => c.json({ error: 'not found' }, 404));

app.route('/api', api);

// --- Statikus frontend ----------------------------------------------------
// Kézzel, WEB_DIST abszolút útvonalról. A @hono/node-server serveStatic
// `root`-ja a cwd-hez képest oldódik fel, nem a modulhoz — Dockerben és
// npm workspace-ből indítva is más cwd-t kapnánk, és néma 404-eket adna.

const MIME = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'text/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.webmanifest': 'application/manifest+json; charset=UTF-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=UTF-8',
  '.txt': 'text/plain; charset=UTF-8',
};

/** A hash-elt nevű bundle-ök örökre cache-elhetők; minden más nem. */
const isHashed = (p) => /\/assets\/.+-[A-Za-z0-9_-]{8,}\.\w+$/.test(p);

app.get('*', async (c) => {
  const rel = decodeURIComponent(new URL(c.req.url).pathname);
  const target = resolve(WEB_DIST, '.' + rel);

  // Path traversal elleni védelem: a feloldott útvonal nem hagyhatja el a dist-et.
  if (target === WEB_DIST || target.startsWith(WEB_DIST + '/')) {
    try {
      if ((await stat(target)).isFile()) {
        const ext = target.slice(target.lastIndexOf('.'));
        c.header('Content-Type', MIME[ext] ?? 'application/octet-stream');
        c.header(
          'Cache-Control',
          isHashed(rel) ? 'public, max-age=31536000, immutable' : 'no-cache',
        );
        return c.body(await readFile(target));
      }
    } catch {
      /* nincs ilyen fájl → SPA-fallback */
    }
  }

  try {
    const html = await readFile(join(WEB_DIST, 'index.html'), 'utf8');
    c.header('Cache-Control', 'no-cache');
    return c.html(html);
  } catch {
    return c.text('A frontend build hiányzik (web/dist/index.html).', 503);
  }
});

serve({ fetch: app.fetch, port: PORT }, ({ port }) => {
  console.log(`marci-server :${port}  db=${DB_PATH}  auth=${SHARED_TOKEN ? 'on' : 'off'}`);
});
