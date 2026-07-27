---
type: Feature
title: Tevékenységtípusok és színek
description: A kezdő paletta, a __none__ pszeudotípus, és miért szerkeszthető a lista.
tags: [ui, dataviz, color, data-model]
status: stable
generated: { by: "anthropic/claude-opus-5", at: "2026-07-27T19:35:00Z" }
---

> **Megvalósítva** 2026-07-27-én. Belépési pont: `web/src/views/Settings.tsx, server/src/db.js`

# Miért szerkeszthető a lista

Mert egy kisgyerek rutinja **változik**. Ami ma „altatás", az fél év múlva nem létezik; megjelenik
a bölcsi, eltűnik a délelőtti alvás. Egy kódba drótozott lista fél éven belül elavulna, és
minden változtatás deployt igényelne.

Ezért a tevékenységtípusok az **adatbázisban** élnek (`activities` tábla), a markerekhez hasonlóan
szinkronizálódnak a két telefon között, és a beállításokban szerkeszthetők.

# A kezdő paletta

| id | Címke | Szín | Árnyalat | Megjegyzés |
|---|---|---|---|---|
| `alvas` | Alvás | `#4A56C4` | 250° indigó | A leghosszabb és legfontosabb blokk |
| `altatas` | Altatás | `#8B6FD0` | 275° ibolya | **Szándékosan** az alvás szomszédja — összetartoznak |
| `etkezes` | Étkezés | `#DE8A2C` | 35° borostyán | |
| `furdes` | Fürdés | `#2A9CBE` | 195° türkiz | |
| `jatek` | Játék / ébren | `#3FA36E` | 155° zöld | Az alapértelmezett „minden más" |
| `program` | Séta / program | `#8AA82E` | 80° olíva | |
| `bolcsi` | Bölcsi / óvoda | `#C0559B` | 325° magenta | Előre felvéve, amikor aktuálissá válik |
| `__none__` | Nincs rögzítés | `#A9AEB8` | semleges | **Pszeudotípus**, lásd lentebb |

## Ami a színválasztás mögött van

**Az árnyalatok szétosztása szándékos.** A hét árnyalat: 35°, 80°, 155°, 195°, 250°, 275°, 325°.
A legkisebb távolság az `alvas` és az `altatas` között van (25°), és **ez szándékos**: a két
tevékenység fogalmilag összetartozik, egymás mellett fordul elő, és ha vizuálisan is rokonok,
az esti blokk egyben olvasható marad. Minden más pár legalább 40°-ra van.

**Az `alvas` kapja a legsötétebb, legtelítettebb kéket.** Ez az egyetlen szegmens, ami a napi
sáv negyedét-harmadát kitölti; ha világos lenne, elnyomná a többit. A sötét kék ráadásul
kulturálisan is az éjszakát idézi — a
[többnapos áttekintésen](/features/tobbnapos-attekintes.md) az éjszakai blokkok azonnal
felismerhetők.

**A `__none__` az egyetlen szín nélküli.** Semleges szürke, mert nem tevékenység, hanem hiány.

## Amit az implementációnak ellenőriznie kell

Ezek a hex-értékek **kiindulópontok, nem validált tokenek**. Mielőtt véglegesednek:

1. **Kontraszt.** A szegmensre írt szöveg érje el a 4.5:1 arányt. Valószínűleg minden színhez
   kell egy sötét és egy világos szövegváltozat, típusonként eldöntve.
2. **Sötét mód.** A telített színek sötét háttéren túl élénkek. Kell egy sötét módú variáns
   (jellemzően alacsonyabb telítettség, magasabb világosság).
3. **Színvakság.** Deuteranopiában a `jatek` (155° zöld) és a `program` (80° olíva) összecsúszik.
   **Ezt nem színnel oldjuk meg**, hanem azzal, hogy a szín soha nem az egyetlen kódolás —
   lásd a [többnapos áttekintés](/features/tobbnapos-attekintes.md) 3. szabályát.

# A `__none__` pszeudotípus

Nem valódi tevékenység, hanem a
[határjelölő modell](/decisions/2026-07-27-hatarjelolo-adatmodell.md) szükséges kiegészítője:
ez zár le egy szegmenst anélkül, hogy újat kezdene.

Mindenhol külön kezelendő:

- **Nem törölhető és nem szerkeszthető** a beállításokban.
- A [gyorsrögzítésben](/features/gyorsrogzites.md) „Vége" felirattal jelenik meg, a többi gombtól
  vizuálisan elkülönítve.
- **Kimarad a statisztikából.** A „mennyit játszott ma" kérdés szempontjából a nem rögzített idő
  nem nulla, hanem *ismeretlen* — a kettő összemosása hamis adatot ad.
- A [többnapos áttekintésen](/features/tobbnapos-attekintes.md) halvány szürke, hogy ne vonja
  magára a figyelmet, de látszódjon, hol vannak a lyukak.

# Adatmodell

```sql
CREATE TABLE activities (
  id         TEXT    PRIMARY KEY,   -- 'alvas', 'furdes', ... — kliens által generált slug
  label      TEXT    NOT NULL,
  color      TEXT    NOT NULL,      -- '#RRGGBB'
  icon       TEXT,                  -- opcionális emoji vagy ikonnév
  sort       INTEGER NOT NULL,      -- a gyorsrögzítő gombok sorrendje
  edited_at  INTEGER NOT NULL,
  deleted_at INTEGER,
  seq        INTEGER NOT NULL
);
```

**A törlés itt is soft delete**, és ennek külön oka van: ha egy típust fizikailag törölnénk, a rá
hivatkozó **régi markerek árván maradnának**, és a múltbeli napok olvashatatlanná válnának. A
törölt típus eltűnik a gyorsrögzítő gombok közül, de a régi szegmensek továbbra is helyesen
jelennek meg.

A `sort` mező már **nem a gombok sorrendjét adja**: azt a
[használati pontszám](/features/gyorsrogzites.md#sorrend-használat-szerint) határozza meg,
azonnali újraszámolással. A `sort` csak azoknál dönt, amiket még soha nem használtunk — hogy egy
új típus se essen véletlenszerű helyre.

A kézi, húzással állítható sorrendezés ezzel értelmét vesztette, ezért **kikerült a felületről**.
A szerver `POST /api/activities/reorder` végpontja megmaradt, de a kliens nem hívja.
