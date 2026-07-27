---
type: Glossary
title: Glosszárium
description: A projekt szótára — marker, szegmens, logikai nap, LWW, seq, dirty és a többi.
tags: [reference, vocabulary]
status: stable
generated: { by: "anthropic/claude-opus-5", at: "2026-07-27T19:45:00Z" }
---

A projekt fogalmai. Akkor bővítsd, ha egy szakkifejezés felmerült, és nem volt egyértelmű, mit
jelent **ebben** a projektben. Az általános szakszavakat (`service worker`, `IndexedDB`) csak
akkor vedd fel, ha itt speciális jelentésük van.

# Adatmodell

**Marker** (határjelölő) — A tárolt alapegység: `{id, at, activityId, note}`. Jelentése: *„ettől a
pillanattól ez történik"*. **Egyetlen időbélyege van**, az `at` — lásd
[architektúra](/architecture.md#az-adatmodell-határjelölők).

**Szegmens** — Két egymást követő marker közti időszak. **Nincs tárolva**, a rendezett
markerlistából származik. A „mennyi ideig tartott a fürdés" kérdés mindig szegmensre vonatkozik,
de az adatbázisban markerek vannak.

**`at`** — A marker mezője: az esemény **valós ideje**, epoch ms-ben. Ez az egyetlen időbélyeg,
amit a felhasználó közvetlenül módosít (az [idővonalon](/features/napi-idovonal.md) húzogatva).

**`__none__`** — Pszeudo-tevékenység: *„innentől nincs rögzítés"*. Lezár egy szegmenst anélkül,
hogy újat nyitna. Enélkül a modell nem tudna lyukat kifejezni. Mindenhol külön kezelendő — lásd
[tevékenységtípusok](/features/tevekenysegtipusok.md).

**Logikai nap** — A `[04:00, következő nap 04:00)` félig nyílt intervallum, **helyi idő szerint**.
Nem azonos a naptári nappal. Azért van, hogy az éjszakai alvás ne törjön ketté — lásd
[döntés](/decisions/2026-07-27-logikai-napkezdet.md). Következmény: a napi lekérdezés **soha nem**
`WHERE date(at) = ?`.

**Futó tevékenység** — Nem külön állapot, hanem az utolsó marker, ami **már elkezdődött**
(`at <= now`). A `now` szűrés nem elméleti: egy elgépelt visszamenőleges rögzítés jövőbeli markert
hoz létre, és enélkül az válna „futóvá", 0:00-s stopperrel. A [határjelölő modell](/decisions/2026-07-27-hatarjelolo-adatmodell.md) egyik
haszna, hogy ez nem igényel külön mezőt vagy kezelést.

# Adatelérés

**Carry-in** — A `GET /api/markers?from&to` mindig visszaadja a `from` előtti **utolsó** markert is.
Nem kényelmi extra: a nap első szegmensét szinte mindig egy előző napi marker definiálja (az esti
alvás), és enélkül a nap eleje üresnek látszana — ami adatvesztésnek tűnik, pedig lekérdezési hiba.
**A rendszer legkönnyebben elrontható pontja.** Szerveroldali szabály, tesztek őrzik.

**Ablak** — Az a nap-tartomány, amit a kliens éppen a memóriában tart (alapból 45 nap
visszamenőleg). A Napok nézet „Korábbi napok" gombja bővíti.

**Archiválás** — A tevékenységtípus `archived` jelölést kap, nem törlődik. Oka **nem** a szinkron:
fizikai törlésnél a rá hivatkozó régi markerek árván maradnának, és a múltbeli napok
olvashatatlanná válnának.

# Platform és üzemeltetés

**PWA** — Itt konkrétan: a Safariból „Kezdőképernyőhöz adás"-sal feltett webapp. **Nem** böngészőfül.
A megkülönböztetés lényeges: a kezdőképernyős példány külön tárterületen él, és más képességei
vannak — lásd [iOS Safari PWA](/integrations/ios-safari-pwa.md).

**Logikai napkezdet** — lásd [Logikai nap](#adatmodell).

**Volume** — A Coolify-ban a konténerhez rendelt perzisztens tároló, ami a `/data` útvonalra
mountolódik. **Enélkül minden redeploy törli az adatbázist** — a projekt legveszélyesebb
konfigurációs pontja, lásd [Coolify + Hetzner](/integrations/coolify-hetzner.md).

**`node:sqlite`** — A Node beépített SQLite-modulja. Ezt használjuk a `better-sqlite3` helyett:
nincs natív függőség, tehát az alpine Docker-image elég, és nincs fordítási lépés.

**`SHARED_TOKEN`** — Opcionális környezeti változó. Ha üres vagy hiányzik, az API nyílt (a
[jelenlegi döntés](/decisions/2026-07-27-nincs-hitelesites.md)); ha be van állítva, minden
`/api/*` kérés `X-Marci-Token` fejlécet vár. A kód **támogassa a legelső verziótól**, kikapcsolt
állapotban.

# Wiki

**OKF** — *Open Knowledge Format* v0.2: a frontmatter-konvenció, amit ez a wiki követ.
Kötelező mező a `type`; a `sources`/`generated`/`verified`/`status` családok teszik a
gépi karbantartású tudásbázist megbízhatóvá. Lásd [séma](/CLAUDE.md).

**Bizalmi szint** — Az OKF `verified` mezőjéből származtatva: *unverified* (nincs `verified`),
*machine-confirmed* (csak gépi aktor), *human-reviewed* (van `human:` aktor). A wiki oldalainak
túlnyomó része jelenleg **unverified**.

**Aktor** — `<gyártó>/<verzió>` ágensre, `human:<id>` emberre, `process:<id>` automatizmusra.
A `human:` prefix az, ami az emberi jóváhagyást gépileg megkülönböztethetővé teszi.
