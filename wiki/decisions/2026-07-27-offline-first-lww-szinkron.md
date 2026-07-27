---
type: Decision
title: Offline-first, last-write-wins szinkronnal
description: A UI soha nem vár hálózatra; a két telefon LWW-vel fésülődik össze, kliens edited_at alapján, szerver seq kurzorral.
tags: [sync, offline, data-model]
status: deprecated
generated: { by: "anthropic/claude-opus-5", at: "2026-07-27T18:35:00Z" }
sources:
  - id: session
    resource: /assets/2026-07-27-terv-beszelgetes.md
    title: Tervezői beszélgetés — offline-first választás
    author: human:frkandris
    last_modified: 2026-07-27
---

> **⚠️ FELÜLÍRVA 2026-07-27-én.** Utód: [Online-only — a szerver az egyetlen
> igazságforrás](/decisions/2026-07-27-online-only.md). A felhasználó felülvizsgálta a kiinduló
> feltevést („mindig nethez vagyunk kapcsolódva"), amivel az itt leírt teljes gépezet — IndexedDB,
> `dirty` jelölés, LWW, `seq` kurzor — indoklás nélkül maradt. **Az alábbi tartalom történeti**:
> azt rögzíti, miért tűnt jó döntésnek akkor, és mi lenne a helyes megoldás, ha az offline-igény
> visszatérne.

# Kontextus

Két telefon írja ugyanazt az adathalmazt, és a rögzítés helyszínei rosszak a lefedettség
szempontjából: fürdőszoba, gyerekszoba, nyaraló. A rögzítés pillanata ráadásul időkritikus — ha
az app hálózatra vár, mire válaszol, az ember már elfelejtette, hánykor kezdődött a fürdés.

A felhasználó az „offline-first" opciót választotta a „csak online" helyett.

# Mérlegelt opciók

| Opció | Mellette | Ellene |
|---|---|---|
| **Csak online** | Triviális kód. Nincs ütközés, nincs lokális tár. | Net nélkül használhatatlan. Minden koppintás után hálózati várakozás. |
| **Offline-first, LWW** | A UI azonnal reagál. Két eszköz determinisztikusan konvergál. Kevés kód. | Konkurens szerkesztésnél az egyik oldal módosítása némán elveszik (nincs mezőnkénti merge). |
| **Offline-first, CRDT** (pl. Yjs, Automerge) | Konkurens szerkesztés is összefésülődik, veszteség nélkül. | Jelentős függőség és fogalmi teher. Nagyobb tár. Két családi telefonra súlyos túllövés. |

# Döntés

**Offline-first, last-write-wins összefésüléssel.** Minden írás azonnal az IndexedDB-be megy és
`dirty`-nek jelölődik; a szinkron a háttérben, opportunista módon fut. Az ütközést a **kliens
`edited_at`** dönti el, holtversenyben a `device_id` lexikografikus összehasonlítása. A
szinkronkurzor viszont a **szerver által osztott `seq`**.

# Miért

**Az azonnali visszajelzés nem kényelmi kérdés, hanem az adat helyességének feltétele.** A
rögzített időpont akkor pontos, ha a gomb megnyomásának pillanatában keletkezik. Bármilyen
hálózati várakozás vagy hibaüzenet arra tanítja a felhasználót, hogy „majd később beírom" — és a
később beírt idő már becslés, nem mérés.

**A CRDT itt túllövés.** A CRDT azt a problémát oldja meg, amikor sok szerkesztő módosítja
*ugyanazt a mezőt* konkurensen, és minden változtatás megőrzendő. Itt két ember van, akik szinte
mindig **különböző** markereket írnak (aki éppen a gyerekkel van, az rögzít), és a ritka ütközésnél
a „ki nyúlt hozzá utoljára" válasz nemcsak elfogadható, hanem **helyes is** — az utolsó szerkesztés
általában a javítás. A CRDT ára — függőség, tárméret, hibakeresési nehézség — semmit nem vásárolna.

**Miért a kliens `edited_at` dönt, és nem a szerver érkezési ideje?** Mert az ütközésnél a helyes
kérdés az, hogy *mikor döntött úgy az ember*, nem az, hogy melyik telefon jutott előbb hálózathoz.
Ha a szerver érkezési sorrendje döntene, akkor egy hétvégén offline maradt telefon hétfőn
felülírná az időközben, tudatosan elvégzett javításokat. Az `edited_at` ezt kizárja.

**Miért nem az `edited_at` a szinkronkurzor is?** Mert **kliensóra, tehát nem monoton a rendszer
egészére nézve.** Ha az egyik telefon órája pár másodperccel hátra jár, az általa írt sorok
`edited_at`-je a másik kliens már feldolgozott kurzora *alá* eshetne — és a sor **örökre
láthatatlan maradna**. A szerver által osztott `seq` monotonitása garantált, mert egyetlen
számláló, egyetlen tranzakcióban. Ez a két mező tehát nem redundancia: két különböző problémát
old meg, és a felcserélésük némán adatot veszít.

**Miért kell a `device_id` holtversenytörés?** Enélkül két azonos `edited_at`-ű, különböző
tartalmú sor esetén a végeredmény a feldolgozási sorrendtől függene — vagyis a két telefon
**eltérő** végállapotra konvergálhatna, ami pont az LWW ígéretének megsértése. A `device_id`
determinisztikus, a sorrendtől független döntést ad.

# Következmények

- **Mezőnkénti merge nincs.** A későbbi `edited_at` a *teljes* rekordot felülírja. Ha az egyik
  telefonon a jegyzet, a másikon az időpont módosul konkurensen, az egyik változás elveszik.
  Ez a korlát a felülírással tárgytalanná vált — lásd [online-only](/decisions/2026-07-27-online-only.md).
- **A törlés is csak egy mező.** A `deleted_at` ugyanazon az LWW-n megy át; a sorok soha nem
  törlődnek fizikailag, mert egy tényleges `DELETE` a másik eszköz `since`-kurzora számára
  láthatatlan lenne, és a sor feltámadna.
- **A kliensóra hitelesnek van tekintve.** Aki előreállítja a telefonja óráját, minden ütközést
  megnyer. Nem védekezünk ellene — két családi telefonnál ez nem fenyegetési modell.
- **iOS-en a szinkron csak előtérben futhat**, mert nincs Background Sync API — lásd
  [iOS Safari PWA](/integrations/ios-safari-pwa.md). Következmény: ha az egyik telefont napokig
  nem nyitják meg, addig nem is szinkronizál. Ez a `seq`-kurzoros modellel probléma nélkül
  behozható, akármilyen régi is a kurzor.
- **A `seq`-számláló egyetlen globális érték** a `meta` táblában. Ha valaha shardolás vagy több
  szerver merülne fel, ez a döntés újranyitandó.
