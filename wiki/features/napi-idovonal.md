---
type: Feature
title: Napi idővonal
description: A nap egyetlen sávon, húzható határokkal — az utólagos javítás helye.
tags: [ui, core, timeline, editing]
status: stable
generated: { by: "anthropic/claude-opus-5", at: "2026-07-27T19:25:00Z" }
---

> **Megvalósítva** 2026-07-27-én. Belépési pont: `web/src/views/Day.tsx`

# Mit ad

A felhasználó eredeti kérése:

> „szeretném, ha tudnánk valami timeline-on húzogatni ezeket az időpontokat utólag is (hoppá,
> mégsem aludt el)"

Ez a képernyő az, ahol a rögzített nap **javítható**. A [gyorsrögzítés](/features/gyorsrogzites.md)
gyors, de pontatlan — mindig később nyomjuk meg a gombot, mint ahogy az esemény történt. Itt lehet
ezt helyrerakni.

# A képernyő

Függőleges elrendezés, mert a nap 20+ óráját vízszintesen egy telefonon nem lehet olvashatóan
kitenni, és mert a függőleges görgetés a természetes mozdulat:

```
  ← 2026-07-26   2026-07-27   2026-07-28 →

   04:00 ┤ ░░░░░░  Alvás
         │ ░░░░░░
   06:30 ╪━━━━━━━  ← húzható határ (44pt találati terület)
         │ ▓▓▓▓▓▓  Játék
   07:15 ╪━━━━━━━
         │ ▒▒▒▒▒▒  Étkezés   32 p
   07:47 ╪━━━━━━━
         │ ▓▓▓▓▓▓  Játék
         ⋮
   18:05 ╪━━━━━━━
         │ ████████ Fürdés   ← koppintásra: szerkesztőlap
   18:40 ╪━━━━━━━
         │ ▓▓▓▓▓▓  Altatás
         │ ▓▓▓▓▓▓  ⏱ fut
```

# A három szerkesztési művelet

Mindhárom **egyetlen rekord egyetlen mezőjét** írja — ez a
[határjelölő adatmodell](/decisions/2026-07-27-hatarjelolo-adatmodell.md) egész haszna:

| Művelet | Mozdulat | Mit ír |
|---|---|---|
| **Határ mozgatása** | A `╪` fogantyú húzása | `marker.at` |
| **Típus átírása** | Koppintás a szegmensre → típusválasztó | `marker.activity_id` |
| **Marker törlése** | Koppintás a szegmensre → Törlés | `marker.deleted_at`; a két szomszédos szegmens összeolvad |

Nincs „szegmens nyújtása" művelet, mert nincsenek szegmensek — csak határok. A „hoppá, mégsem
aludt el" tipikusan a **típus átírása** (alvás → altatás) vagy a **határ húzása** (később aludt el).

# A húzás mechanikája

**A határ nem mehet át a szomszédain.** A mozgatható tartomány `(előző marker at, következő marker
at)`, kizárólagosan. Ha a felhasználó túlhúzza, a fogantyú megáll a szomszéd értékénél — nem
tolja maga előtt a többit, és nem is enged nulla hosszú szegmenst.

**Élő visszajelzés húzás közben.** A fogantyú mellett folyamatosan látszik az aktuális időpont
(`18:07`), és a két érintett szegmens hossza újraszámolódik. Enélkül a felhasználó vakon húz.

**Finomhangolás.** Egy 20 órás nap egy telefonképernyőn ~1 pixel/perc felbontású. Ez a percre
pontos igazításhoz kevés. Két megoldás, mindkettő kell:
- A húzás **5 perces rácsra** ugrik alapból (a rögzített idők úgysem pontosabbak ennél).
- **Nagyítás**: csippentéssel vagy egy szegmensre duplán koppintva a nézet ráközelít az adott
  órára, ahol már percre lehet igazítani.

**Visszavonás.** Egy elhúzott határ visszaállítása legyen egy koppintás („Visszavonás" toast
néhány másodpercig). Enélkül a húzás félelmetes művelet — az ember nem mer hozzányúlni, mert nem
tudja visszacsinálni. A visszavonás a régi `at` visszaírása, ami megint csak egy mezőírás.

# A nap határa — a legkönnyebben elrontható pont

A nap **04:00-kor kezdődik**, nem éjfélkor
([döntés](/decisions/2026-07-27-logikai-napkezdet.md)). Ebből következik két szabály, amit az
implementációnak be kell tartania:

1. **A lekérdezés mindig hozza el a nap kezdete előtti utolsó markert is.** A nap első szegmensét
   szinte mindig egy előző napi marker definiálja (az esti alvás). Ha ez kimarad, a nap eleje
   üresen jelenik meg — és ez úgy néz ki, mint egy adatvesztés, pedig lekérdezési hiba.
2. **A nap első és utolsó szegmense levágott**, nem teljes. A megjelenített hossz a nap
   határáig tart, de a szegmens valódi hossza ennél több. Ha valaha hossz-statisztika készül,
   ezt külön kell kezelni.

# iOS-specifikumok

A húzás iOS-en több beépített gesztussal versenyez. A `touch-action: none`, `user-select: none` és
`-webkit-touch-callout: none` **nem opcionális** a fogantyúkon — a részleteket lásd az
[iOS Safari PWA](/integrations/ios-safari-pwa.md) érintés-szakaszában.

Használj Pointer Eventeket (`pointerdown`/`pointermove`/`pointerup`) a touch- és egéresemények
külön kezelése helyett, és `setPointerCapture`-t, hogy a húzás ne szakadjon meg, ha az ujj
lecsúszik a fogantyúról.
