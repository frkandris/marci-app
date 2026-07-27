---
type: Feature
title: Gyorsrögzítés
description: A főképernyő — egy koppintás rögzíti, hogy most kezdődött egy tevékenység, élő stopperrel.
tags: [ui, core, capture]
status: stable
generated: { by: "anthropic/claude-opus-5", at: "2026-07-27T19:20:00Z" }
---

> **Megvalósítva** 2026-07-27-én. Belépési pont: `web/src/views/Capture.tsx`

# Mit ad

Ez a képernyő az app **egyetlen indoka**. Minden más — az idővonal, az áttekintés — utólagos
elemzés; ez viszont a rögzítés pillanata, és ha ez lassú vagy bizonytalan, az egész app
használhatatlan.

A cél: **a telefon előkapásától a rögzítésig legfeljebb két koppintás**, és nulla várakozás.

# A képernyő

```
┌────────────────────────────────┐
│                                │
│           FÜRDÉS               │  ← a futó tevékenység, nagyban
│           12:34                │  ← élő stopper, másodpercre
│        18:05 óta               │
│                                │
│  ─────────────────────────     │
│  ▓▓▓▓░░░░░░░░░░░░░░░░░░░░░     │  ← a mai nap mini-sávja, koppintásra
│  16:00        20:00            │    az idővonalra visz
│  ─────────────────────────     │
│                                │
│  Mi következik?                │
│  ┌────────┐ ┌────────┐         │
│  │ Vacsora│ │ Fürdés │         │  ← nagy célpontok, min. 44×44 pt
│  ├────────┤ ├────────┤         │
│  │ Altatás│ │  Alvás │         │
│  ├────────┤ ├────────┤         │
│  │  Játék │ │ Vége   │         │  ← „Vége" = a __none__ pszeudotípus
│  └────────┘ └────────┘         │
│                                │
│  [ Nem most kezdődött? ]       │  ← visszamenőleges rögzítés
└────────────────────────────────┘
   ↑ safe-area-inset-bottom
```

# Viselkedés

**Egy gomb megnyomása** létrehoz egy markert `at: Date.now()`-val, és a megnyomott tevékenységre
vált. Ez **azonnal** megtörténik lokálisan — a képernyő átvált, a stopper nullázódik, a hálózat
szóba sem kerül. A [végigvezetett példa](/architecture.md#végigvezetett-példa-elkezdődött-a-fürdés)
lépésről lépésre végigviszi ugyanezt.

**A „Vége" gomb** a `__none__` pszeudo-tevékenységet rögzíti: lezárja a futó szegmenst anélkül,
hogy újat kezdene. Ez kell ahhoz, hogy a nap ne végződjön egy örökké futó tevékenységgel.

**A „Nem most kezdődött?"** egy visszamenőleges rögzítés: ugyanaz a gombrács, de előtte egy
időválasztóval. Erre azért van szükség, mert a valóságban gyakran csak percekkel később jut eszébe
az embernek, hogy rögzítsen — és a becsült, de bevallottan visszamenőleges idő jobb, mint a
hamis „most".

# Amit tudatosan nem csinál

- **Nem kér megerősítést.** Egy téves koppintás olcsón javítható az
  [idővonalon](/features/napi-idovonal.md); egy megerősítő párbeszéd viszont minden helyes rögzítést
  megdrágít. Rossz csere.
- **Nem mutat hibát hálózati problémánál.** A rögzítés lokálisan sikerült; a szinkron a
  [szinkronizáció](/features/szinkronizacio.md) dolga, és csendben, később megy. A felhasználót nem érdekli
  és nem is tud vele mit kezdeni fürdetés közben.
- **Nem kér megerősítést kétszer.** A visszavonás bőven elég.

# Sorrend: használat szerint

> **Ez a döntés 2026-07-27-én megfordult.** Korábban itt az állt, hogy a sorrend fix marad, mert
> „az izommemória többet ér, mint az optimalizált sorrend". A felhasználó ezt felülbírálta:
> *„nem érdekel az izommemória, azonnal számolódjon újra"*.

A gombok **használati pontszám szerint** rendeződnek, minden változás után azonnal újraszámolva.
A pontszám a gyakoriságot és a frissességet **egyetlen számban** fejezi ki:

```
pontszám(tevékenység) = Σ  0.5 ^ (rögzítés_kora_napokban / 7)
```

Vagyis egy mai rögzítés 1,0 pontot ér, egy hete 0,5-öt, két hete 0,25-öt. Így nem kell külön
rendezni „gyakran" és „legutóbb" szerint — a kettő ugyanabból a képletből jön ki.

**Egyetlen koppintás nem feltétlenül mozdít a sorrenden**, és ez helyes: egy 39-szer használt
tevékenységet nem előz meg egy most rögzített. A sorrend hetek alatt követi, mi változott a
gyerek rutinjában.

A soha nem használtak a kézi `sort` sorrendjükben követik a többit, hogy egy új típus se essen
véletlenszerű helyre. A viselkedés a **Beállítások** fülön kikapcsolható; ilyenkor a kézi,
húzással állított sorrend érvényes.

# Visszavonás: „Mégsem ez volt"

A futó tevékenység kártyáján megjelenik egy gomb, ami **megnevezi, mihez tér vissza**
(„Mégsem ez volt — vissza: Alvás"). A legutolsó marker törlésével az előző szegmens folytatódik
onnan, ahol abbamaradt. 10 percig ajánljuk fel; utána a [napi idővonal](/features/napi-idovonal.md)
a javítás helye.

**A „Vége" gombra is vonatkozik.** Az is elnyomható tévedésből, és utána nincs futó tevékenység,
tehát a régi, csak futásra szűrő logika nem kínálta fel. A gomb ezért a **legutolsó markerre**
vonatkozik, a típusától függetlenül; `__none__`-nál a felirata „Mégsem ért véget — vissza: X".

A minta a Toggl *Discard idle and continue* megoldásából jön: nem tűnő toast, hanem tartós,
önmagát megmagyarázó művelet ott, ahol a szem amúgy is van.

# Figyelmeztetés a beragadt tevékenységre

Ha a futó tevékenység **12 óránál régebben** indult, a képernyő jelezze — jellemzően azt jelenti,
hogy valaki elfelejtett „Vége"-t nyomni lefekvéskor. Enélkül a statisztika csendben hazudik; ez a
[határjelölő modell](/decisions/2026-07-27-hatarjelolo-adatmodell.md) ismert következménye.

# iOS-specifikumok

- A gombsáv a képernyő alján: `padding-bottom: env(safe-area-inset-bottom)`, magasság `100dvh`
  alapon — a `100vh` levágná. Lásd [iOS Safari PWA](/integrations/ios-safari-pwa.md).
- A stopper `requestAnimationFrame` helyett **másodpercenkénti** `setInterval`-lal frissüljön, és
  `visibilitychange`-nél igazodjon újra a valós időhöz — háttérben az iOS lassítja vagy leállítja
  az időzítőket, így visszatéréskor a számláló elcsúszna.
