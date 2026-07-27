---
type: Workflow
title: Telepítés iPhone-ra
description: A kezdőképernyőre tétel lépésről lépésre, mindkét telefonra — és a buktatók.
tags: [ios, pwa, install, workflow]
status: draft
generated: { by: "anthropic/claude-opus-5", at: "2026-07-27T20:05:00Z" }
---

> **Állapot: tervezett.** Az app még nem létezik és nincs domain; ez a szándékolt folyamat.

# Miért kell ezt leírni

Mert iOS-en **nincs telepítés-gomb**. A `beforeinstallprompt` esemény nem létezik Safariban, tehát
az app nem tud felajánlani semmit — a felhasználónak magától kell tudnia a menetet. Ha ez nincs
leírva, a második telefonra fél év múlva senki nem fogja tudni feltenni.

# Az URL

**`https://marci.kozossegek.com`**

HTTPS-en kell lennie: IP-címen, HTTP-n **nem működik** — nincs service worker, nincs manifest,
nincs kezdőképernyős app. Lásd [Coolify + Hetzner](/integrations/coolify-hetzner.md).

# A menet — mindkét telefonon

1. **Safariban** nyisd meg a `https://marci.kozossegek.com` címet.
   ⚠️ **Kizárólag Safariban.** Chrome-ból, Firefoxból vagy egy alkalmazásba ágyazott böngészőből
   (Messenger, Gmail linkjéből) a „Kezdőképernyőhöz adás" vagy nem elérhető, vagy nem PWA-ként
   teszi ki. Ha linken keresztül érkeztél, előbb nyisd meg Safariban.
2. **Megosztás** ikon (a négyzet felfelé mutató nyíllal) az alsó sávon.
3. Görgess le → **„Hozzáadás a Kezdőképernyőhöz"**.
4. Írd át a nevet, ha akarod (pl. `Marci`), majd **Hozzáadás**.
5. **Indítsd el az új ikonról**, ne a Safari-fülről.

# Ellenőrzés, hogy tényleg PWA-ként fut

- **Nincs Safari-címsor és nincs alsó navigációs sáv.** Ha látszik a címsor, akkor csak egy
  könyvjelző készült — töröld és kezdd újra a 2. lépéstől.
- **Repülőgép módban is elindul** és mutatja a korábbi adatokat.

# Két buktató, amit előre kell tudni

**1. A Safari-fül és a kezdőképernyős app KÜLÖN tárterületen él.**
Amit a Safariban rögzítettél tesztelés közben, az **nem lesz ott** az ikonról indított appban, és
fordítva. Ez nem hiba. Az igazi használat mindig az ikonról induljon.

**2. ⚠️ Az ikon törlése törli a lokális adatot.**
Ha valaki leszedi az appot a kezdőképernyőről, a még **fel nem szinkronizált** változások
elvesznek. A már felszinkronizált adat biztonságban van a szerveren, és újratelepítés után
visszajön. Ezért mutat a UI jelzést, ha van függőben lévő változás — lásd
[szinkronizáció](/features/szinkronizacio.md).

# A második telefon

Ugyanaz a menet, ugyanaz az URL. Nincs párosítás, nincs meghívó, nincs bejelentkezés — az API
[jelenleg nyílt](/decisions/2026-07-27-nincs-hitelesites.md), tehát a második telefon az első
szinkron után automatikusan látja az összes korábbi adatot.

Az eszközök megkülönböztetése a `device_id` alapján történik, amit mindkét telefon az első
indításkor magának generál.

# Frissítés

**Nem kell semmit csinálni**, de nem is azonnali. A service worker a következő indításnál veszi
észre az új verziót, és a beépített frissítési jelzés („új verzió elérhető, újratöltés")
kínálja fel. Ha valami beragadna, az ikon törlése és újra kitétele mindig segít — de előbb
győződj meg róla, hogy nincs függőben lévő, fel nem szinkronizált változás.
