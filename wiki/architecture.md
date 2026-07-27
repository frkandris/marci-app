---
type: Architecture
title: Architektúra
description: A Marci időmérő tervezett felépítése — rétegek, adatmodell, szinkronprotokoll, és egy végigvezetett példa.
tags: [architecture, pwa, sync, sqlite]
status: draft
generated: { by: "anthropic/claude-opus-5", at: "2026-07-27T18:20:00Z" }
stale_after: 2026-10-31
sources:
  - id: session
    resource: /assets/2026-07-27-terv-beszelgetes.md
    title: Tervezői beszélgetés — követelmények és választások
    author: human:frkandris
    last_modified: 2026-07-27
---

> **Állapot: tervezett.** 2026-07-27-én ebből egyetlen sor kód sem létezik. Ez a lap a szándékot
> rögzíti, hogy az implementáció ne induljon el újra a nulláról. Amint a kód megszületik, ez az
> oldal `stable`-re vált, `file:line` hivatkozásokkal — lásd a [séma](/CLAUDE.md) állapotszakaszát.

# A rendszer egy mondatban

Egy Node-konténer fut a Hetzner-szerveren Coolify alatt; ugyanaz a folyamat szolgálja ki a React
PWA statikus buildjét és a `/api` végpontokat; az adat egyetlen SQLite-fájlban él egy volume-on;
a két iPhone lokálisan, IndexedDB-be ír azonnal, és a háttérben szinkronizál.

```
   iPhone A                        iPhone B
 ┌──────────────┐               ┌──────────────┐
 │  React PWA   │               │  React PWA   │
 │  IndexedDB   │◀── igazság    │  IndexedDB   │
 │  (dirty set) │    lokálisan  │  (dirty set) │
 └──────┬───────┘               └──────┬───────┘
        │  GET/POST /api/changes        │
        └───────────────┬───────────────┘
                        ▼
        ┌───────────────────────────────┐
        │  Hetzner + Coolify v4.1.2     │
        │  ┌─────────────────────────┐  │
        │  │ Docker: node:22-alpine  │  │
        │  │  Hono                   │  │
        │  │   ├── /api/*   JSON     │  │
        │  │   └── /*       statikus │  │
        │  └───────────┬─────────────┘  │
        │              ▼                │
        │   volume: /data/marci.db      │
        └───────────────────────────────┘
```

# Rétegek

| Réteg | Mi | Miért így |
|---|---|---|
| `web/` | React 19 + TypeScript + Vite + `vite-plugin-pwa` | A `vite-plugin-pwa` generálja a manifestet és a Workbox service workert; az iOS-nek nincs `beforeinstallprompt`-ja, ezért a telepítés kézi — lásd [iOS Safari PWA](/integrations/ios-safari-pwa.md) |
| Lokális tár | IndexedDB, `idb` wrapperrel | Az egyetlen írható igazság a kliensen. A UI **soha nem vár a hálózatra.** |
| Szinkron | Saját, `GET`/`POST /api/changes` | Két eszközre a CRDT túllövés; a [LWW döntés](/decisions/2026-07-27-offline-first-lww-szinkron.md) indokolja |
| `server/` | Node 22 + Hono + `better-sqlite3` | A Hono kicsi és gyors; a `better-sqlite3` szinkron API-ja egyszálas Node-on tranzakcióban a legegyszerűbb helyes megoldás |
| Adattár | SQLite, `/data/marci.db` | [Döntés](/decisions/2026-07-27-sqlite-adattar.md) |
| Futtatás | Egy Docker-image, egy port | [Döntés](/decisions/2026-07-27-egy-konteneres-deploy.md) |

# Az adatmodell: határjelölők

Ez a rendszer legfontosabb terve. A teljes indoklás a
[határjelölő adatmodell döntésben](/decisions/2026-07-27-hatarjelolo-adatmodell.md) van; itt a
mechanika.

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

Ebből következik, amit így ingyen kapunk:

- **Nincs átfedés.** Konstrukcióból, nem ellenőrzésből.
- **A húzogatás egyetlen mező írása.** Egy határ mozgatása egyszerre zárja korábban az előzőt és
  kezdi később a következőt — pontosan az, amit a felhasználó „valami véget ér, és valami
  következő kezdődik" alatt ért.
- **A „hoppá, mégsem aludt el" javítás** háromféle triviális művelet: a marker húzása, a
  típusának átírása, vagy a törlése (a szomszédos szegmens ilyenkor összeolvad).
- **A futó tevékenység** nem külön állapot: egyszerűen a legutolsó marker, aminek még nincs
  rákövetkezője.

A `__none__` egy **pszeudo-tevékenység**: „innentől nincs rögzítés". Ez zár le egy szegmenst
anélkül, hogy újat nyitna — enélkül a modell nem tudna lyukat kifejezni.

## SQLite-séma

```sql
CREATE TABLE markers (
  id          TEXT    PRIMARY KEY,   -- crypto.randomUUID(), a kliens adja
  at          INTEGER NOT NULL,      -- epoch ms — az esemény VALÓS ideje
  activity_id TEXT    NOT NULL,      -- activities.id, vagy '__none__'
  note        TEXT,
  device_id   TEXT    NOT NULL,      -- melyik telefon rögzítette
  edited_at   INTEGER NOT NULL,      -- epoch ms, KLIENSÓRA — az ütközés ezen dől el
  deleted_at  INTEGER,               -- soft delete; a sor sosem tűnik el
  seq         INTEGER NOT NULL       -- SZERVER által osztott, monoton — a szinkronkurzor
);
CREATE INDEX markers_seq ON markers(seq);
CREATE INDEX markers_at  ON markers(at);

CREATE TABLE activities (
  id         TEXT    PRIMARY KEY,
  label      TEXT    NOT NULL,
  color      TEXT    NOT NULL,       -- hex, lásd features/tevekenysegtipusok.md
  icon       TEXT,
  sort       INTEGER NOT NULL,
  edited_at  INTEGER NOT NULL,
  deleted_at INTEGER,
  seq        INTEGER NOT NULL
);

CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT);  -- itt él a globális seq-számláló
```

**A három időbélyeg különbözik, és a keverésük a legvalószínűbb jövőbeli hiba forrása:**

| Mező | Kinek az órája | Mire való | Módosítja a felhasználó? |
|---|---|---|---|
| `at` | kliens | az esemény valós ideje | **Igen** — ezt húzogatja az idővonalon |
| `edited_at` | kliens | ütközésfeloldás (LWW) | Nem, automatikus |
| `seq` | **szerver** | szinkronkurzor | Nem, a szerver osztja |

Azért kell mindkettő, mert **külön problémát oldanak meg**: a `seq` monoton és megbízható kurzor
(a kliensórák elcsúszhatnak, így kurzornak alkalmatlanok), az `edited_at` viszont azt fejezi ki,
hogy *mikor döntött úgy az ember*, ami az ütközésnél a helyes kérdés. Ha az `edited_at`-tel
kurzoroznánk, egy hátraállított telefonóra örökre elrejtene sorokat.

# Szinkronprotokoll

Két végpont, mindkettő idempotens.

**`GET /api/changes?since=<seq>`** → mindaz, ami a kurzor óta változott:

```json
{
  "serverSeq": 412,
  "markers":    [ { "id": "...", "at": 1785000000000, "activityId": "furdes",
                    "deviceId": "iphone-a", "editedAt": 1785000012345,
                    "deletedAt": null, "seq": 411 } ],
  "activities": [ /* ugyanez a forma */ ]
}
```

**`POST /api/changes`** → a kliens elküldi a piszkos (`dirty`) sorait, és ugyanazt a választ kapja
vissza, mint a `GET`-nél, a saját `since`-étől:

1. A szerver **tranzakcióban** minden beérkező sorra alkalmazza az LWW-szabályt:
   ```
   a beérkező nyer, ha  incoming.edited_at > existing.edited_at
                    vagy (egyenlőség esetén) incoming.device_id > existing.device_id
   ```
   A `device_id`-s holtversenytörés nem szépészet: enélkül két eszköz **eltérő** végállapotra
   konvergálhat, ha ugyanabban az ezredmásodpercben szerkesztettek, és az LWW ígérete megtörik.
2. Minden ténylegesen megváltozott sor **friss `seq`-et kap** (`meta.seq_counter` inkrementálva).
3. A válaszban a kliens megkapja a beolvasztott állapotot; a `dirty` jelölést csak ezután törli.

**A kliens oldali szabály:** a lokális írás azonnal megtörténik és `dirty`-nek jelölődik. A
szinkron indul appindításkor, `visibilitychange`-nél (előtérbe kerülés), sikeres írás után
debounce-olva, és `online` eseménynél. **Nem indul** időzítve a háttérben — iOS-en nincs
Background Sync, lásd [iOS Safari PWA](/integrations/ios-safari-pwa.md).

Bővebben a kliensoldalról: [features/szinkronizacio.md](/features/szinkronizacio.md).

## Amit ez a protokoll tudatosan NEM old meg

- **Szerkesztés-egyesítés.** Ha mindkét telefon ugyanazt a markert módosítja offline, a
  későbbi `edited_at` **teljesen** felülírja a másikat, mezőnként nincs merge. Két családi
  telefonnál ez elfogadható; egy csapatnál nem lenne az.
- **Törlés–szerkesztés verseny.** A `deleted_at` is csak egy mező, ugyanaz az LWW dönt: ha a
  törlés `edited_at`-je későbbi, a törlés nyer.
- **Kliensóra-manipuláció.** Ha valaki előreállítja a telefonja óráját, az `edited_at`-jei
  megnyerik az összes ütközést. Nem védekezünk ellene.

# Végigvezetett példa: „elkezdődött a fürdés"

Ez a minta, amit minden új feature követ. A rétegeken végig egyetlen művelet:

1. **UI** — [`features/gyorsrogzites.md`](/features/gyorsrogzites.md). Az apa megnyomja a
   „Fürdés" gombot a főképernyőn.
2. **Domain** — létrejön egy marker: `{ id: crypto.randomUUID(), at: Date.now(),
   activityId: 'furdes', deviceId: <sajat>, editedAt: Date.now(), deletedAt: null }`.
   Az `at` és az `editedAt` most **véletlenül** azonos; egy későbbi húzogatásnál már nem lesz az.
3. **Lokális tár** — IndexedDB `markers` store, `dirty: true` jelöléssel. **Egy tranzakció, nincs
   `await` hálózatra.**
4. **UI-visszajelzés** — a store-változás azonnal újrarendereli a képernyőt: a „Fürdés" lesz a futó
   tevékenység, indul a stopper. A felhasználó ekkorra már kész van; minden további háttérmunka.
5. **Szinkron** — a debounce-olt scheduler `POST /api/changes`-t küld a dirty sorokkal.
6. **Szerver** — LWW-tranzakció, új `seq`, írás az SQLite-ba.
7. **Válasz** — a kliens megkapja a beolvasztott sort, frissíti a `seq`-et, törli a `dirty`-t.
8. **A másik telefon** — a következő előtérbe kerülésekor `GET /api/changes?since=<sajat seq>`,
   és megjelenik a fürdés.

Ha a 5–8. lépés bármelyike elhasal (nincs net, alszik a szerver), **a felhasználó nem vesz észre
semmit**: a marker lokálisan megvan, `dirty` marad, és a következő alkalommal megy fel. Ez az
offline-first ígéret teljes tartalma.

# Kapcsolódó

- [Glosszárium](/glossary.md) — marker, szegmens, logikai nap, LWW, `seq`, dirty
- [features/napi-idovonal.md](/features/napi-idovonal.md) — hogyan lesz a húzogatásból `at`-írás
- [runbooks/mentes-visszaallitas.md](/runbooks/mentes-visszaallitas.md) — mert egyetlen fájlban
  van minden adat
