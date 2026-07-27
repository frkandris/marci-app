---
type: Feature
title: Gyorsrögzítés
description: A főképernyő — egy koppintás rögzíti, hogy most kezdődött egy tevékenység, élő stopperrel.
tags: [ui, core, capture]
status: draft
generated: { by: "anthropic/claude-opus-5", at: "2026-07-27T19:20:00Z" }
---

> **Állapot: tervezett.** Még nincs implementálva.

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
- **Nem rendezi át magát dinamikusan.** Kísértő lenne a gombokat használati gyakoriság szerint
  sorbarendezni, de akkor **elmozdulna a helyük** — és az izommemória többet ér, mint az
  optimalizált sorrend. A sorrend a [tevékenységtípusok](/features/tevekenysegtipusok.md) `sort`
  mezőjéből jön, és csak kézzel változik.

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
