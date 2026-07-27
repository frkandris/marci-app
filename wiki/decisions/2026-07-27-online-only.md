---
type: Decision
title: Online-only — a szerver az egyetlen igazságforrás
description: Nincs kliensoldali tár, nincs ütközésfeloldás; sima REST, 30 másodperces lekérdezéssel.
tags: [sync, architecture, simplification, core]
status: stable
generated: { by: "anthropic/claude-opus-5", at: "2026-07-27T21:30:00Z" }
sources:
  - id: session
    resource: /assets/2026-07-27-terv-beszelgetes.md
    title: Tervezői beszélgetés — az offline-first visszavonása
    author: human:frkandris
    last_modified: 2026-07-27
---

# Kontextus

Az [offline-first döntés](/decisions/2026-07-27-offline-first-lww-szinkron.md) implementálva lett:
IndexedDB lokális tár, `dirty` jelölés, last-write-wins ütközésfeloldás `edited_at` alapján, és
szerveroldali `seq` szinkronkurzor.

Ezután a felhasználó felülvizsgálta a kiinduló feltevést:

> „valojaban nem kell szinkron, mindig nethez vagyunk kapcsolodva, egyszerusitheted"

Ez nem apró finomhangolás: az offline-first **teljes** gépezete arra a feltevésre épült, hogy a
rögzítés pillanatában lehet, hogy nincs hálózat. Ha ez a feltevés nem áll, a gépezet indoklás
nélkül marad.

# Mérlegelt opciók

| Opció | Mellette | Ellene |
|---|---|---|
| **Marad az offline-first** | Már megírva és tesztelve. Hálózatkimaradásnál is működne. | Három egymást fedő mechanizmus (dirty, LWW, kurzor) tart karban egy problémát, ami nem áll fenn. Minden jövőbeli feature-t megdrágít. |
| **Online-only** ← választva | Kiesik az IndexedDB, a `dirty`, az LWW, a `seq`, a `device_id`, a soft delete. Sima REST. **Az adatmodell is egyszerűsödik**: a markernek három időbélyeg helyett egy marad. | Hálózat nélkül nem használható. Egy elszálló kérés elveszett rögzítés. |
| **Online-only + írási sor** | Elveszett kérés nélkül. | Visszahozná a fél offline gépezetet — pont amit el akarunk hagyni. |

# Döntés

**A szerver az egyetlen igazságforrás.** Nincs kliensoldali perzisztens tár. Minden művelet
közvetlen REST-hívás, és a válaszban visszakapott sor kerül a React-állapotba.

A friss adat két úton érkezik: **előtérbe kerüléskor** (`visibilitychange`) és **30 másodpercenként**,
amíg az app látható.

# Miért

**A kód mennyisége nem a fő nyereség — a fogalmi teher az.** Az LWW helyessége három egymást
feltételező szabályon állt: `edited_at` dönt, `seq` kurzoroz, `device_id` tör holtversenyt. Mindhármat
érteni kellett minden jövőbeli módosításnál, és a
[szinkronizáció oldal](/features/szinkronizacio.md) két külön bekezdést szentelt annak, hogy melyik
lépés sorrendje miért nem cserélhető fel. Egy kétfelhasználós családi appnál ez a teher nem térül meg.

**Az adatmodell is tisztább lett.** A marker korábban három időbélyeget hordozott (`at`, `edited_at`,
`seq`), és a wiki külön táblázatban figyelmeztetett, hogy a keverésük a legvalószínűbb jövőbeli hiba
forrása. Most **egy** időbélyeg van, az `at` — az, ami a felhasználót érdekli. Ez a fajta
egyszerűsödés a bugok egész osztályát szünteti meg, nemcsak sorokat töröl.

**A törlés is valódi törlés lett.** A soft delete kizárólag azért kellett, hogy a másik eszköz
kurzora lássa a törlést. Kurzor nélkül ez az indok elesik, és a `deleted_at` mező minden
lekérdezésből kikerülhetett.

**Amit elvesztünk, azt a felhasználó tudatosan adta fel.** Hálózat nélkül az app nem működik, és
egy elszálló kérés elveszett rögzítés. Ez valós ár — a mérséklése (lásd lent) olcsó, de teljesen
megszüntetni csak a most eltávolított gépezettel lehetne.

# Következmények

- **A `web/dist` mérete ~5 kB-tal csökkent**, de ennél fontosabb, hogy egy egész fájl
  (`sync.ts` logikája) és egy függőség (`idb`) kiesett.
- **A hibakezelés láthatóvá vált.** Offline-first alatt a hálózati hiba *elrejtendő* volt (a `dirty`
  majd újrapróbálja); most **jelezni kell**, mert magától nem javul. Ezért mutat az app hibasávot,
  ha egy mentés elszállt, és a korábban betöltött adat a képernyőn marad.
- **A carry-in a szerverre költözött.** A `GET /api/markers?from&to` mindig elhozza a `from` előtti
  utolsó markert is — ez a szabály korábban kliensoldali volt. Így egy helyen van, és
  [szervertesztek](/workflows/fejlesztoi-kornyezet.md) őrzik.
- **A 30 másodperces lekérdezés a két telefon közti késleltetés felső korlátja.** Ha ez valaha
  kevés lesz, a következő lépés SSE vagy WebSocket, **nem** a szinkron visszahozása.
- **Ha a hálózatnélküliség mégis problémává válik** (nyaraló, pincelakás), ez a döntés
  újranyitandó — de akkor sem az egész LWW-gépezet kell vissza, hanem egy egyszerű, lokális
  írási sor. Az ütközésfeloldás csak akkor indokolt, ha *offline szerkesztés* is kell, nem csak
  offline rögzítés.
