/**
 * Ikongenerátor függőség nélkül: RGBA puffer → PNG, natív zlib-bel.
 * A motívum az app szignatúrája: egy nap sávokra bontva (lásd a Napok nézetet).
 * Futtatás: node scripts/make-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../public');

const BG = [0x17, 0x1a, 0x21];
const SLEEP = [0x4a, 0x56, 0xc4];
const MEAL = [0xde, 0x8a, 0x2c];
const BATH = [0x2a, 0x9c, 0xbe];
const PLAY = [0x3f, 0xa3, 0x6e];

/** Három nap egymás alatt, mindegyik teljes szélességű — ez a Napok nézet motívuma. */
const ROWS = [
  [
    { c: SLEEP, from: 0.0, to: 0.26 },
    { c: PLAY, from: 0.29, to: 0.52 },
    { c: MEAL, from: 0.55, to: 0.65 },
    { c: BATH, from: 0.68, to: 0.78 },
    { c: SLEEP, from: 0.81, to: 1.0 },
  ],
  [
    { c: SLEEP, from: 0.0, to: 0.31 },
    { c: PLAY, from: 0.34, to: 0.5 },
    { c: MEAL, from: 0.53, to: 0.62 },
    { c: BATH, from: 0.65, to: 0.74 },
    { c: SLEEP, from: 0.77, to: 1.0 },
  ],
  [
    { c: SLEEP, from: 0.0, to: 0.22 },
    { c: PLAY, from: 0.25, to: 0.55 },
    { c: MEAL, from: 0.58, to: 0.67 },
    { c: BATH, from: 0.7, to: 0.82 },
    { c: SLEEP, from: 0.85, to: 1.0 },
  ],
];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** 4× supersampling: olcsó élsimítás, külön rajzolókönyvtár nélkül. */
function render(size, { rounded }) {
  const S = 4;
  const N = size * S;
  const acc = new Float64Array(size * size * 3);
  const cnt = size * size;
  const r = rounded ? N * 0.22 : 0;

  const inside = (x, y) => {
    if (!rounded) return true;
    const cx = Math.min(Math.max(x, r), N - r);
    const cy = Math.min(Math.max(y, r), N - r);
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  };

  const pad = N * 0.17;
  const inner = N - 2 * pad;
  const rowH = inner * 0.26;
  const gap = (inner - rowH * ROWS.length) / (ROWS.length - 1);

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let col = inside(x, y) ? BG : null;
      if (col) {
        for (let i = 0; i < ROWS.length; i++) {
          const top = pad + i * (rowH + gap);
          if (y < top || y >= top + rowH) continue;
          for (const b of ROWS[i]) {
            const x0 = pad + inner * b.from;
            const x1 = pad + inner * b.to;
            if (x >= x0 && x < x1) col = b.c;
          }
        }
      }
      if (!col) continue;
      const px = ((y / S) | 0) * size + ((x / S) | 0);
      acc[px * 3] += col[0];
      acc[px * 3 + 1] += col[1];
      acc[px * 3 + 2] += col[2];
    }
  }

  const out = Buffer.alloc(size * size * 4);
  const div = S * S;
  for (let i = 0; i < cnt; i++) {
    out[i * 4] = Math.round(acc[i * 3] / div);
    out[i * 4 + 1] = Math.round(acc[i * 3 + 1] / div);
    out[i * 4 + 2] = Math.round(acc[i * 3 + 2] / div);
    out[i * 4 + 3] = 255;
  }
  return encodePng(size, size, out);
}

mkdirSync(OUT, { recursive: true });
// Az apple-touch-icon NEM lehet átlátszó és nem lehet lekerekített: az iOS
// maga vágja a sarkokat, az alfát pedig feketére renderelné.
writeFileSync(join(OUT, 'apple-touch-icon.png'), render(180, { rounded: false }));
writeFileSync(join(OUT, 'icon-192.png'), render(192, { rounded: true }));
writeFileSync(join(OUT, 'icon-512.png'), render(512, { rounded: true }));
console.log('Ikonok kiírva:', OUT);
