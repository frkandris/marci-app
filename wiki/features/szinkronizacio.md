---
type: Feature
title: Szinkronizáció (kliensoldal)
description: Dirty flag, kurzor, és a kérdés, hogy mikor fut a szinkron — iOS-en ez nem magától értetődő.
tags: [sync, offline, ios, core]
status: draft
generated: { by: "anthropic/claude-opus-5", at: "2026-07-27T19:40:00Z" }
---

> **Állapot: tervezett.** Még nincs implementálva.

A protokoll szerveroldali fele és az LWW-szabály az
[architektúrában](/architecture.md#szinkronprotokoll) van; a *miért* pedig az
[offline-first döntésben](/decisions/2026-07-27-offline-first-lww-szinkron.md). Ez a lap a
kliensoldali mechanikáról szól.

# A lokális állapot

Az IndexedDB két store-t tart (`markers`, `activities`), és minden rekord hordoz egy lokális,
**nem szinkronizált** `dirty: boolean` mezőt. Emellett egy `meta` store tárolja a
`lastSeq` kurzort és a `deviceId`-t (első indításkor generált UUID, azután állandó).

Az alapszabály: **minden felhasználói művelet lokális írás + `dirty: true`, és semmi más.** A UI
soha nem vár hálózatra, soha nem mutat hálózati hibát rögzítés közben.

# Mikor fut a szinkron

Ez a lap legfontosabb része, mert iOS-en **nincs Background Sync API** — lásd
[iOS Safari PWA](/integrations/ios-safari-pwa.md). Nem lehet megbízni abban, hogy a rendszer
majd elintézi. A szinkron kizárólag akkor futhat, ha az app **előtérben van**:

| Kiváltó ok | Miért |
|---|---|
| App indítása | A leggyakoribb belépési pont |
| `visibilitychange` → látható | Ez pótolja a Background Syncet: minden előtérbe kerülés egy szinkronpont |
| Sikeres lokális írás után, **debounce-olva** (~3 mp) | Hogy a gyors egymásutáni rögzítések egy kérésbe menjenek |
| `online` esemény | Hálózat visszatérésekor azonnal |
| Kézi húzás lefelé az áttekintőn | Mert néha az ember tudni akarja, hogy naprakész-e |

**Nem fut** időzítve a háttérben, és nem fut, amíg az app be van zárva. Következmény: ha az egyik
telefont napokig nem nyitják meg, addig nem is szinkronizál. Ez rendben van — a `seq`-kurzoros
modell akármilyen régi kurzort behoz, egyetlen kéréssel.

# Egy szinkronciklus

```
1. dirty = minden rekord, ahol dirty === true
2. POST /api/changes  { since: lastSeq, markers: dirty.markers, activities: dirty.activities }
3. a válasz beolvasztása:
     minden érkező sorra: ha a lokális példány dirty ÉS a lokális edited_at nagyobb
                          → a lokálisat tartjuk meg (a következő körben újra felmegy)
                          különben → felülírjuk a szerverivel
4. lastSeq = válasz.serverSeq
5. a felküldött és a szerver által elfogadott sorokon dirty = false
```

**A 3. lépés feltétele nem elhagyható.** Ha a válasz beolvasztása közben a felhasználó éppen
szerkesztett valamit (ami tipikus: a szinkron a háttérben fut, miközben az ember az idővonalat
húzogatja), a friss lokális módosítás **elveszne**, ha vakon felülírnánk. Az `edited_at`
összehasonlítása ugyanaz a szabály, amit a szerver is alkalmaz — ezért konvergál a két oldal.

**Az 5. lépés sorrendje számít.** A `dirty` jelölést **csak a válasz megérkezése és sikeres
beolvasztása után** szabad törölni. Ha előbb törölnénk és a kérés elhasalna, a változás némán
eltűnne — soha többé nem menne fel.

# Hibakezelés

- **Hálózati hiba**: nincs teendő. A `dirty` marad, a következő kiváltó ok újrapróbálja.
  A felhasználót **nem zavarjuk** ezzel.
- **5xx**: ugyanaz, mint a hálózati hiba.
- **4xx**: ez viszont hibás kliens, és **jelezni kell**, mert magától nem javul.
- **Egymást átfedő szinkronok**: egyszerre csak egy futhat. Egy egyszerű futás-jelző elég; a
  közben érkező kérések eldobhatók, mert a következő kiváltó ok úgyis mindent felvisz.

# Amit a felhasználó lát ebből

Majdnem semmit — és ez a cél. Egyetlen diszkrét jelzés kell:

**ha van fel nem szinkronizált változás, az látszódjon.** Nem hibaként, hanem állapotként (pl. egy
kis pont a fejlécben). Ennek konkrét oka van: iOS-en **a kezdőképernyős ikon törlése törli a
lokális tárat**, tehát a fel nem töltött adat elveszik. Ha a felhasználó látja, hogy van
függőben lévő változás, van esélye előbb hálózatot keresni.
