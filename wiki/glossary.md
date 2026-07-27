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

**Marker** (határjelölő) — A tárolt alapegység. Jelentése: *„ettől a pillanattól ez történik"*.
Mezői közül a három időbélyeg (`at`, `edited_at`, `seq`) különböző dolgot jelent, és a keverésük a
legvalószínűbb hibaforrás — lásd
[architektúra](/architecture.md#az-adatmodell-határjelölők).

**Szegmens** — Két egymást követő marker közti időszak. **Nincs tárolva**, a rendezett
markerlistából származik. A „mennyi ideig tartott a fürdés" kérdés mindig szegmensre vonatkozik,
de az adatbázisban markerek vannak.

**`at`** — A marker mezője: az esemény **valós ideje**, epoch ms-ben. Ez az egyetlen időbélyeg,
amit a felhasználó közvetlenül módosít (az [idővonalon](/features/napi-idovonal.md) húzogatva).

**`edited_at`** — A marker mezője: mikor **szerkesztette** a rekordot valaki, kliensóra szerint.
Kizárólag az [LWW](#lww) ütközésfeloldásra szolgál. **Nem kurzor** — kliensóra, tehát nem monoton.

**`seq`** — A marker mezője: a **szerver** által osztott, szigorúan monoton sorszám. Kizárólag
szinkronkurzorként szolgál. **Nem használható ütközésfeloldásra** — nem azt fejezi ki, mikor
döntött úgy az ember, hanem azt, hogy melyik kérés ért be előbb.

**`__none__`** — Pszeudo-tevékenység: *„innentől nincs rögzítés"*. Lezár egy szegmenst anélkül,
hogy újat nyitna. Enélkül a modell nem tudna lyukat kifejezni. Mindenhol külön kezelendő — lásd
[tevékenységtípusok](/features/tevekenysegtipusok.md).

**Logikai nap** — A `[04:00, következő nap 04:00)` félig nyílt intervallum, **helyi idő szerint**.
Nem azonos a naptári nappal. Azért van, hogy az éjszakai alvás ne törjön ketté — lásd
[döntés](/decisions/2026-07-27-logikai-napkezdet.md). Következmény: a napi lekérdezés **soha nem**
`WHERE date(at) = ?`.

**Futó tevékenység** — Nem külön állapot, hanem egyszerűen az a marker, aminek még nincs
rákövetkezője. A [határjelölő modell](/decisions/2026-07-27-hatarjelolo-adatmodell.md) egyik
haszna, hogy ez nem igényel külön mezőt vagy kezelést.

# Szinkron

<a id="lww"></a>
**LWW** (*last-write-wins*) — Az ütközésfeloldási szabály: a nagyobb `edited_at`-ű rekord nyer,
holtversenyben a nagyobb `device_id`. A holtversenytörés nem szépészet — enélkül két eszköz
**eltérő** végállapotra konvergálhatna. Mezőnkénti merge nincs: a nyertes a **teljes** rekordot
felülírja.

**`dirty`** — Kliensoldali, **nem szinkronizált** jelölés: ez a rekord lokálisan módosult, és még
nem került fel a szerverre. Csak a sikeres válasz beolvasztása **után** törölhető — lásd
[szinkronizáció](/features/szinkronizacio.md).

**`device_id`** — Telefononkénti UUID, első indításkor generálva, azután állandó. Két szerepe van:
az LWW holtversenytörése, és annak nyilvántartása, melyik telefon rögzítette az eseményt (ez adja
a „ki írta be" információt user-fiókok nélkül — lásd
[nincs hitelesítés](/decisions/2026-07-27-nincs-hitelesites.md)).

**Kurzor** (`lastSeq`) — A kliens által tárolt legutolsó látott `seq`. Ezt küldi `since`-ként.
Akármilyen régi lehet: egy hetekig nem használt telefon egyetlen kéréssel behozza a lemaradását.

**Soft delete** — A rekordok soha nem törlődnek fizikailag, csak `deleted_at`-et kapnak. Oka:
egy valódi `DELETE` a másik eszköz kurzora számára láthatatlan lenne, és a sor **feltámadna** a
következő szinkronnál.

# Platform és üzemeltetés

**PWA** — Itt konkrétan: a Safariból „Kezdőképernyőhöz adás"-sal feltett webapp. **Nem** böngészőfül.
A megkülönböztetés lényeges: a kezdőképernyős példány külön tárterületen él, és más képességei
vannak — lásd [iOS Safari PWA](/integrations/ios-safari-pwa.md).

**Logikai napkezdet** — lásd [Logikai nap](#adatmodell).

**Volume** — A Coolify-ban a konténerhez rendelt perzisztens tároló, ami a `/data` útvonalra
mountolódik. **Enélkül minden redeploy törli az adatbázist** — a projekt legveszélyesebb
konfigurációs pontja, lásd [Coolify + Hetzner](/integrations/coolify-hetzner.md).

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
