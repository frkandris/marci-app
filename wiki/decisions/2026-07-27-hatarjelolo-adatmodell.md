---
type: Decision
title: Határjelölő adatmodell intervallumok helyett
description: A nap határjelölők rendezett sorozata; a szegmens a következő markerig tart, nem tárolt end mezőig.
tags: [data-model, timeline, core]
status: stable
generated: { by: "anthropic/claude-opus-5", at: "2026-07-27T18:30:00Z" }
sources:
  - id: session
    resource: /assets/2026-07-27-terv-beszelgetes.md
    title: Tervezői beszélgetés — a követelmény megfogalmazása
    author: human:frkandris
    last_modified: 2026-07-27
---

# Kontextus

A felhasználó a követelményt így fogalmazta meg:

> „szóval ilyen átmenetek vannak, valami véget ér, és valami következő kezdődik"

és külön kiemelte az utólagos javítás igényét:

> „szeretném, ha tudnánk valami timeline-on húzogatni ezeket az időpontokat utólag is (hoppá,
> mégsem aludt el)"

Ez a két mondat együtt egy adatmodell-döntést kényszerít ki. A „mi mennyi ideig tartott" kérdés
első ránézésre intervallumokat sugall, a megfogalmazás viszont **átmenetekről** szól.

# Mérlegelt opciók

| Opció | Mellette | Ellene |
|---|---|---|
| **Intervallum** — `{ start, end, activity }` | Kézenfekvő. Egy sor = egy tevékenység, a hossz közvetlenül olvasható. | A húzogatás **két sort** ír egyszerre (az előző `end`-jét és a következő `start`-ját). Átfedés és lyuk bármikor előállhat → invariánsellenőrzés és javítólogika kell. A „nyitott" (még tartó) tevékenység `end: null`-ként külön eset mindenhol. |
| **Határjelölő** — `{ at, activity }`, a szegmens a következőig tart | A húzogatás **egyetlen mező** írása. Átfedés és lyuk **konstrukcióból** lehetetlen. A futó tevékenység nem külön eset: az utolsó marker. A törlés két szegmenst összeolvaszt, magától. | A hossz származtatott, nem tárolt — minden lekérdezéskor a rendezett listából számolódik. Lyukat csak pszeudo-tevékenységgel lehet kifejezni. |

# Döntés

A tárolt egység a **határjelölő (marker)**: `{ id, at, activity_id, ... }`. Egy marker jelentése
*„ettől a pillanattól ez történik"*. A szegmens a következő marker `at`-jéig tart. A lyukat a
`__none__` pszeudo-tevékenység fejezi ki („innentől nincs rögzítés").

# Miért

**A húzogatás a termék lelke, és a határjelölő teszi triviálissá.** A felhasználó nem két
eseményt akar szerkeszteni, hanem *egy határt megfogni és arrébb tenni*. Intervallumoknál ehhez
két rekordot kell tranzakcióban, konzisztensen írni, és minden hibás félrementés átfedést vagy
lyukat hagy. Határjelölőnél ugyanez **egy `at` mező** új értéke. A húzás nem tud inkonzisztens
állapotot előállítani, mert nincs mit inkonzisztenssé tenni.

**A „hoppá, mégsem aludt el" pontosan három triviális műveletre bomlik**, és mindhárom
egy-rekordos: a marker húzása (`at`), a típusa átírása (`activity_id`), vagy a törlése
(`deleted_at`) — utóbbinál a két szomszédos szegmens magától összeolvad, mert soha nem is voltak
külön entitások.

**Az invariánsokat nem betartatni kell, hanem nem megsérteni.** Az „átfedésmentes, hézagmentes
napi idővonal" intervallumoknál egy futásidőben ellenőrizendő szabály; határjelölőknél a
reprezentáció következménye. Ez a fajta csere — futásidejű ellenőrzés helyett szerkezetből adódó
helyesség — az, ami miatt a modell hosszabb távon nem termel bugokat.

**A szinkronnal is jobban játszik.** A [LWW-összefésülés](/decisions/2026-07-27-offline-first-lww-szinkron.md)
független rekordokon értelmes. Ha két telefon offline ugyanazt az intervallumpárt módosítaná, az
LWW két *összefüggő* sorra alkalmazva olyan végállapotot adhatna, ahol az egyik `end` és a másik
`start` nem esik egybe — azaz a merge maga sértené meg az invariánst. Határjelölőknél minden
rekord önmagában értelmes, így nincs mit elrontani.

**Az ára — a származtatott hossz — olcsó.** A napi markerszám reálisan 10–30 körül van. A
szegmensek kiszámolása egy rendezés és egy végigfutás; a hossz szerinti statisztika ugyanígy.
Semmi nincs, ami ezt drágává tenné ebben a nagyságrendben.

# Következmények

- **A hossz nem lekérdezhető közvetlenül.** Minden „mennyi ideig aludt" típusú kérdés a rendezett
  markerlistából számolódik. Ha egyszer statisztikai nézet kerül be, érdemes lehet egy
  memoizált szegmens-derivációt bevezetni — de nem tárolt oszlopot, mert az duplikálná az igazságot.
- **A `__none__` mindenhol kezelendő.** Nem valódi tevékenység: nem kap színt a palettából (semleges
  szürke), nem jelenik meg a gyorsrögzítő gombok között elsődlegesként, és a statisztikából kimarad.
  Lásd [tevékenységtípusok](/features/tevekenysegtipusok.md).
- **A napi vágás nem triviális.** Egy szegmens átnyúlhat a nap határán, sőt a nap első szegmensét
  gyakran az *előző* napi utolsó marker definiálja. A napi nézet lekérdezésének **mindig el kell
  hoznia a nap kezdete előtti utolsó markert is.** Ez a modell legkönnyebben elrontható pontja —
  lásd [logikai napkezdet](/decisions/2026-07-27-logikai-napkezdet.md) és
  [napi idővonal](/features/napi-idovonal.md).
- **A legutolsó marker mindig „fut".** Ha valaki elfelejt `__none__`-t tenni lefekvéskor, az
  utolsó tevékenység a végtelenségig tart. A UI-nak ezt jeleznie kell (pl. „12 órája fut" →
  figyelmeztetés), különben a statisztika csendben hazudik.
