---
type: Feature
title: Adatfrissítés és többeszközös használat
description: Hogyan látja meg az egyik telefon a másik változásait — és mi történik, ha elmegy a hálózat.
tags: [rest, multi-device, core]
status: stable
generated: { by: "anthropic/claude-opus-5", at: "2026-07-27T21:45:00Z" }
---

> **Ez az oldal 2026-07-27-én át lett írva.** Korábban egy offline-first szinkronmechanizmust
> írt le (IndexedDB, `dirty`, LWW, `seq`). Azt az
> [online-only döntés](/decisions/2026-07-27-online-only.md) váltotta fel.

# Az alapszabály

**A szerver az egyetlen igazságforrás.** A kliens nem tárol semmit tartósan: minden művelet
közvetlen REST-hívás, és a válaszban visszakapott sor kerül a React-állapotba.

Ez azt jelenti, hogy a két telefon soha nem „fésülődik össze" — egyszerűen ugyanazt olvassa.
Nincs ütközés, mert nincs két verzió.

# Mikor frissül az adat

| Kiváltó ok | Miért |
|---|---|
| App indítása | A belépési pont |
| `visibilitychange` → látható | A leggyakoribb eset: előveszed a telefont, és azonnal friss adatot akarsz látni |
| **30 másodpercenként**, amíg az app látható | Ez a felső korlát arra, hogy a másik telefon változása mennyi idő alatt jelenik meg |
| `online` esemény | Hálózat visszatérésekor |
| A fejléc pöttyére koppintva | Kézi frissítés |

Háttérben **nem** kérdezget: ha az app nincs előtérben, nincs értelme.

**A mutációk nem váltanak ki teljes újratöltést.** A `POST`/`PATCH` visszaadja a mentett sort, és
csak azt írjuk vissza az állapotba. Enélkül minden idővonal-húzás után egy teljes lekérés futna,
és a felület akadozna.

# Hibakezelés — ami itt megfordult

Offline-first alatt a hálózati hiba **elrejtendő** volt: a `dirty` jelölés majd újrapróbálja, a
felhasználót nem zavarjuk. Online-only alatt ez megfordul: **a hiba jelzendő, mert magától nem
javul.**

- **Mentés elszállt** → hibasáv a fejléc alatt, konkrét okkal. A rögzítés **nem történt meg**;
  a felhasználónak tudnia kell, hogy újra kell nyomnia.
- **Lekérés elszállt** → a korábban betöltött adat a képernyőn marad, és a hibasáv jelzi, hogy
  elavult lehet. Üres képernyőt mutatni rosszabb lenne, mint egy kicsit régi adatot.
- A státuszpötty a fejlécben: zöld (rendben), lila villogó (tölt), piros (hiba).

# Mennyi adatot tölt be

Az app egy **ablakot** tart a memóriában: alapból a mai naptól visszamenőleg 45 nap (plusz a
holnapi nap kezdetéig, hogy a késő esti rögzítés is beleférjen). A Napok nézet „Korábbi napok"
gombja 30 naponként bővíti.

Ez bőven elég: 45 nap × ~12 marker ≈ 540 sor, néhány tíz kilobájt.

# Amit ez tudatosan nem old meg

- **Hálózat nélkül az app nem használható.** Ez a
  [döntés](/decisions/2026-07-27-online-only.md) tudatosan vállalt ára.
- **Nincs élő push.** Ha a 30 másodperces késleltetés valaha kevés lesz, a következő lépés SSE
  vagy WebSocket — **nem** a szinkronmechanizmus visszahozása.
- **Egyidejű szerkesztés esetén az utolsó kérés nyer**, mert az fut le utoljára a szerveren.
  Nincs figyelmeztetés arról, hogy a másik telefon közben módosított. Két embernél ez elfogadható.
