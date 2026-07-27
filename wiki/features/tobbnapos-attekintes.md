---
type: Feature
title: Többnapos áttekintés
description: Napok egymás alatt, azonos időtengelyen, színkódolva — itt válik láthatóvá a minta.
tags: [ui, dataviz, timeline]
status: draft
generated: { by: "anthropic/claude-opus-5", at: "2026-07-27T19:30:00Z" }
---

> **Állapot: tervezett.** Még nincs implementálva.

# Mit ad

A felhasználó kérése:

> „lehetne naponta egymás alatt látni, színkódolva lehetnének az egyes mentett tevékenységek"

Ez a nézet **egyetlen dolgot ad, amit más nem**: a napok **függőleges összeolvasását**. Hogy
csúszik-e az elalvás. Hogy a vacsora mindig ugyanakkor van-e. Hogy a rossz éjszakák előtt volt-e
valami közös. Egyetlen napból ez láthatatlan; húsz napból ránézésre kiderül.

# A képernyő

Vízszintes időtengely, függőlegesen a napok — a legutóbbi felül:

```
        04    07    10    13    16    19    22    01    04
        ├─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤
 júl 27 ███████░░▒░░░░▓▓░░░░░░▒▒░░████████████████████████
 júl 26 ███████░░░▒░░░▓▓░░░░░▒▒░░░░███████████████████████
 júl 25 ██████░░▒░░░░░░░▓▓░░░▒▒░░░░░██████████████████████
 júl 24 █████████░░▒░░░░▓▓░░░░░▒▒░░░████████████████████████
 júl 23 ███████░░░▒░░░░░▓▓░░░░▒▒░░░░██████████████████████
        ├─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤

  █ Alvás   ▒ Étkezés   ▓ Fürdés   ░ Játék
```

# A tervezés három szabálya

**1. Minden sor azonos időtengelyt használ.** Ez nem stílus, hanem a nézet létfeltétele: a
függőleges összehasonlítás csak akkor jelent bármit, ha a 19:00 minden sorban ugyanott van. Ezért
bukott meg az „ébredéshez igazított, dinamikus napkezdet" ötlete a
[napkezdet-döntésben](/decisions/2026-07-27-logikai-napkezdet.md).

**2. A tengely 04:00-tól 04:00-ig tart.** Így az éjszakai alvás egyetlen összefüggő blokk a sor
jobb szélén, nem két csonk a két végén.

**3. A szín az egyetlen kódolás, ezért nem elég.** Színvakság mellett (deuteranopia ~8% a férfiak
körében) a zöld/olíva pár összecsúszik. Ezért:
- koppintásra/hosszú nyomásra jelenjen meg a szegmens neve és időtartama,
- a jelmagyarázat mindig látszódjon,
- a leggyakoribb típusok kapjanak **eltérő világosságot** is, ne csak eltérő színárnyalatot.

A konkrét palettát és a kontrasztkövetelményeket a
[tevékenységtípusok](/features/tevekenysegtipusok.md) oldal tartja.

# Interakció

- **Koppintás egy sorra** → átvisz az adott nap [idővonalára](/features/napi-idovonal.md).
- **Koppintás egy szegmensre** → megmutatja a nevét és a hosszát anélkül, hogy navigálna.
- **Görgetés felfelé** → régebbi napok, lapozva töltve. Kezdetben 30 nap elég.

# Megvalósítási megjegyzések

- **Ne rajzold Canvasre.** ~30 sor × ~15 szegmens = néhány száz elem; ez SVG-vel vagy sima
  `div`-ekkel is bőven megy, cserébe kapsz akadálymentességet, találati területet és szöveges
  tooltipet ingyen. Canvas csak akkor indokolt, ha valaha évekre visszamenő nézet kell.
- **A szegmensek a markerlistából származnak**, nem tárolt intervallumokból — lásd
  [architektúra](/architecture.md#az-adatmodell-határjelölők). A derivációt érdemes egyszer
  elvégezni és memoizálni napra bontva, mert ez a nézet sok napot rajzol egyszerre.
- **A napokra bontás nem `date(at)`.** A `[04:00, +24h)` félig nyílt intervallum a szabály, helyi
  idő szerint. Nyári időszámítás váltásakor egy nap 23 vagy 25 órás — a rácsnak ettől nem szabad
  elcsúsznia.
- **Az egy percnél rövidebb szegmensek** is legyenek láthatók: adj minden szegmensnek legalább
  1–2 px minimális szélességet, különben egy elgépelt, azonnal javított marker nyom nélkül eltűnik,
  és a nap „hibásnak" látszik.
