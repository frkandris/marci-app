---
type: Architecture
title: Architektúra
description: A Marci időmérő felépítése — rétegek, adatmodell, REST API, és egy végigvezetett példa.
tags: [architecture, pwa, rest, sqlite]
status: stable
generated: { by: "anthropic/claude-opus-5", at: "2026-07-27T21:40:00Z" }
stale_after: 2026-12-31
sources:
  - id: session
    resource: /assets/2026-07-27-terv-beszelgetes.md
    title: Tervezői beszélgetés — követelmények és választások
    author: human:frkandris
    last_modified: 2026-07-27
---

# A rendszer egy mondatban

Egy Node-konténer fut a Hetzner-szerveren Coolify alatt; ugyanaz a folyamat szolgálja ki a React
PWA statikus buildjét és a `/api` végpontokat; az adat egyetlen SQLite-fájlban él egy volume-on;
a két iPhone közvetlenül ezt írja és olvassa.

```
   iPhone A                        iPhone B
 ┌──────────────┐               ┌──────────────┐
 │  React PWA   │               │  React PWA   │
 │ (React state)│               │ (React state)│
 └──────┬───────┘               └──────┬───────┘
        │   REST + 30 mp-es lekérdezés │
        └───────────────┬───────────────┘
                        ▼
        ┌───────────────────────────────┐
        │  Hetzner + Coolify v4.1.2     │
        │  ┌─────────────────────────┐  │
        │  │ Docker: node:24-alpine  │  │
        │  │  Hono                   │  │
        │  │   ├── /api/*   JSON     │  │
        │  │   └── /*       statikus │  │
        │  └───────────┬─────────────┘  │
        │              ▼                │
        │   volume: /data/marci.db      │
        └───────────────────────────────┘
```

**A szerver az egyetlen igazságforrás.** Nincs kliensoldali perzisztens tár, nincs
ütközésfeloldás — lásd [online-only döntés](/decisions/2026-07-27-online-only.md).

# Rétegek

| Réteg | Mi | Fájl |
|---|---|---|
| UI | React 19 + TypeScript + Vite + `vite-plugin-pwa` | `web/src/App.tsx`, `web/src/views/` |
| Származtatott logika | Szegmensek, logikai nap, húzási korlátok | `web/src/model.ts` |
| Adatelérés | REST-kliens + React-állapot | `web/src/store.ts` |
| HTTP | Hono; `/api/*` és statikus kiszolgálás | `server/src/index.js` |
| Adattár | SQLite a beépített `node:sqlite`-tal | `server/src/db.js` |

**Nincs natív függőség.** Az SQLite a Node beépített `node:sqlite` modulja, nem a
`better-sqlite3` — ezért az alpine image elég, és nincs fordítási lépés a Dockerben. Ez eltérés
az [SQLite-döntés](/decisions/2026-07-27-sqlite-adattar.md) eredeti tervétől; az indoklás
(egy fájl, egy volume, triviális mentés) változatlanul áll.

# Az adatmodell: határjelölők

A rendszer legfontosabb terve. A teljes indoklás a
[határjelölő adatmodell döntésben](/decisions/2026-07-27-hatarjelolo-adatmodell.md) van.

A nap nem intervallumok halmaza, hanem **határjelölők (marker) idő szerint rendezett sorozata**.
Egy marker azt jelenti: *„ettől a pillanattól ez történik"*. A szegmens a következő marker
időpontjáig tart.

```
  17:30        18:05        18:40        19:15              most
    │            │            │            │                 │
    ▼            ▼            ▼            ▼                 ▼
    ├── vacsora ─┼── játék ───┼── fürdés ──┼──── altatás ─────▶ (fut)
   marker       marker       marker       marker
```

Amit ez ingyen ad:

- **Nincs átfedés** — konstrukcióból, nem ellenőrzésből.
- **A húzogatás egyetlen mező írása** (`at`). Egy határ mozgatása egyszerre zárja korábban az
  előzőt és kezdi később a következőt.
- **A törlés két szegmenst összeolvaszt**, magától.
- **A futó tevékenység** nem külön állapot: az utolsó marker, ami **már elkezdődött**
  (`at <= now`). A `now` szűrés nem elméleti — egy elgépelt visszamenőleges rögzítés jövőbeli
  markert hoz létre, és enélkül az válna „futóvá".

A `__none__` **pszeudo-tevékenység**: „innentől nincs rögzítés". Ez zár le egy szegmenst anélkül,
hogy újat nyitna — enélkül a modell nem tudna lyukat kifejezni.

## SQLite-séma

```sql
CREATE TABLE markers (
  id          TEXT    PRIMARY KEY,   -- UUID
  at          INTEGER NOT NULL,      -- epoch ms — az esemény valós ideje
  activity_id TEXT    NOT NULL,      -- activities.id, vagy '__none__'
  note        TEXT
);
CREATE INDEX markers_at ON markers(at);

CREATE TABLE activities (
  id       TEXT    PRIMARY KEY,
  label    TEXT    NOT NULL,
  color    TEXT    NOT NULL,
  icon     TEXT,
  sort     INTEGER NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0
);
```

**Egyetlen időbélyeg van, az `at`** — az, ami a felhasználót érdekli. (Korábban három volt; a
felcserélésük volt a legvalószínűbb hibaforrás. Az
[online-only döntés](/decisions/2026-07-27-online-only.md) szüntette meg ezt az egész
osztályt.)

**Az `archived` oszlop megmaradt, de a felület nem használja.** Eredetileg az árván maradó
markerektől védett; ezt a szerepét azóta átvette a cascade-törlés, ami a régi markereket
`__none__`-ra állítja ahelyett, hogy eldobná őket — így a múltbeli napok szerkezete megmarad,
csak a megnevezés tűnik el. A felületen [egyetlen Törlés gomb](/features/kategoriakezeles.md) van,
archiválás nincs; a soft delete kizárólag API-ból érhető el, szándékos vészkijáratként.

# REST API

| Végpont | Mit csinál |
|---|---|
| `GET /api/health` | `{ok, web}`. **A frontend meglétét is nézi** — a Docker build fázisa csendben elhasalhat úgy, hogy a szerver elindul, de csak 404-et ad |
| `GET /api/markers?from&to` | A `[from, to)` markerei **plusz a carry-in** — lásd lent |
| `POST /api/markers` | `{at, activityId, note?}` → a létrehozott sor |
| `PATCH /api/markers/:id` | Részleges módosítás → a mentett sor. **409, ha az új idő keresztezné a szomszédokat** |
| `DELETE /api/markers/:id` | Valódi törlés (204) |
| `GET /api/activities` | Az összes típus, az archiváltakkal együtt |
| `PUT /api/activities/:id` | **Meglévő** módosítása (404, ha nincs) |
| `POST /api/activities` | Létrehozás — **az azonosítót a szerver osztja** |
| `DELETE /api/activities/:id` | `?hard=1` végleges törlés, `&cascade=1` a használatban lévőnél is. **A felület mindig ezt hívja.** `hard` nélkül archiválás — csak API-szintű vészkijárat |

Az ismeretlen `/api/*` útvonal **JSON 404-et** ad, nem esik át az SPA-fallbackre — különben
`index.html` jönne 200-zal, ami a kliensen JSON-parse hibaként jelentkezne.

## A sorrend-invariánst a szerver őrzi

*Egy határ nem előzheti meg a szomszédait.* A kliens is korlátoz (`dragBounds`), de a saját,
esetleg elavult pillanatképe alapján — **két telefonnal ez kevés**. Ha az egyik az A határt
10:00-ról 10:50-re, a másik a rá következő B-t 11:00-ról 10:10-re húzza, mindkét mozgatás
érvényes a saját nézetében, együtt viszont keresztezik egymást, és ettől **néma módon
felcserélődik két tevékenység sorrendje**.

Ezért a `PATCH` a mentés pillanatában, a DB aktuális állapotából nézi meg a szomszédokat, egy
`BEGIN IMMEDIATE` tranzakción belül. Ütközésnél 409 megy vissza; a kliens azonnal frissít, és a
felhasználó a valós állapoton húzhat újra.

A holtversenytörés itt is `(at, id)` — ugyanaz, amivel a `listMarkers` és a kliens rendez,
különben mást jelentene a „szomszéd" a két oldalon.

## A carry-in — a rendszer legkönnyebben elrontható pontja

A `GET /api/markers?from&to` **mindig elhozza a `from` előtti utolsó markert is.**

Ez nem kényelmi extra: a nap első szegmensét szinte mindig egy **előző napi** marker definiálja
(az esti alvás, ami átnyúlik éjfélen). Enélkül a nap eleje üresen jelenne meg — és ez
adatvesztésnek látszik, pedig lekérdezési hiba.

A szabály **szerveroldali**, és szervertesztek őrzik (`server/test/db.test.js`).

# Végigvezetett példa: „elkezdődött a fürdés"

Ez a minta, amit minden új feature követ:

1. **UI** — [`features/gyorsrogzites.md`](/features/gyorsrogzites.md). Az apa megnyomja a
   „Fürdés" gombot. → `web/src/views/Capture.tsx`
2. **Akció** — `addMarker('furdes')` → `POST /api/markers` a `{at: Date.now(), activityId}`
   törzzsel. → `web/src/store.ts`
3. **Szerver** — validál, beszúr, és **visszaadja a mentett sort**. → `server/src/index.js`
4. **Állapot** — a kliens a visszakapott sort beírja a React-állapotba. **Nincs teljes
   újratöltés** — ez az, ami a húzogatást is folyamatossá teszi.
5. **Render** — a `model.ts` a markerlistából újraszámolja a szegmenseket; a „Fürdés" lesz a futó
   tevékenység, indul a stopper.
6. **A másik telefon** — a következő előtérbe kerüléskor vagy legfeljebb 30 másodpercen belül
   lekéri és megjeleníti.

Ha a 3. lépés elhasal (nincs hálózat, alszik a szerver), **a felhasználó látja**: hibasáv jelenik
meg, és a rögzítés nem történt meg. Ez tudatos csere az offline-first ellenében — lásd
[online-only döntés](/decisions/2026-07-27-online-only.md).

# Kapcsolódó

- [Glosszárium](/glossary.md) — marker, szegmens, logikai nap, carry-in
- [features/napi-idovonal.md](/features/napi-idovonal.md) — hogyan lesz a húzogatásból `at`-írás
- [runbooks/mentes-visszaallitas.md](/runbooks/mentes-visszaallitas.md) — mert egyetlen fájlban
  van minden adat
