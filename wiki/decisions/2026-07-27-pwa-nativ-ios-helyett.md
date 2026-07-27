---
type: Decision
title: PWA natív iOS app helyett
description: Az app kezdőképernyőre tett webappként készül, nem natív iOS buildként.
tags: [platform, ios, pwa, distribution]
status: stable
generated: { by: "anthropic/claude-opus-5", at: "2026-07-27T18:25:00Z" }
sources:
  - id: session
    resource: /assets/2026-07-27-terv-beszelgetes.md
    title: Tervezői beszélgetés — platformválasztás
    author: human:frkandris
    last_modified: 2026-07-27
---

# Kontextus

Az app **két családi iPhone-ra** kell, App Store-ba kifejezetten **nem** megy ki. Ez a
terjesztést teszi a fő kényszerré, nem a funkcionalitást.

A fejlesztői gép felmérése 2026-07-27-én:

```
$ xcodebuild -version
xcode-select: error: tool 'xcodebuild' requires Xcode, but active developer
directory '/Library/Developer/CommandLineTools' is a command line tools instance
```

Vagyis **Xcode nincs telepítve** — csak Command Line Tools. Node v26.5.0 és npm 11.17.0 megvan.

# Mérlegelt opciók

| Opció | Mellette | Ellene |
|---|---|---|
| **PWA** (kezdőképernyőre tett webapp) | Nem kell Xcode. Nem kell Apple Developer fiók. **Nem jár le.** A frissítés egy `git push`. Egy kódbázis, ami a szerverrel együtt deployol. | Nincs natív widget, Live Activity, háttérfutás. A push korlátozottabb. Az iOS-specifikus szívatásokat ismerni kell — lásd [iOS Safari PWA](/integrations/ios-safari-pwa.md). |
| **Expo / React Native**, fizetős fiókkal | Igazi natív app, TestFlight-tal tiszta terjesztés. | ~10–15 GB Xcode telepítés + **99 USD/év** Apple Developer Program egy kétfelhasználós családi appért. |
| **Expo / React Native**, ingyenes fiókkal | Nincs éves díj. | A provisioning profile **7 naponta lejár**: mindkét telefont hetente újra kell csatlakoztatni és újratelepíteni. |

# Döntés

Az app **React + Vite PWA**, amit a Coolify-on futó saját backend szolgál ki, és a Safari
„Kezdőképernyőhöz adás" funkciójával kerül fel mindkét telefonra.

# Miért

**A 7 napos lejárat egyedül eldöntötte a natív ingyenes utat.** Egy szülő nem fog hetente USB-re
dugni két telefont, hogy a vacsoraidőt rögzíthesse. Az app, amit használni kell, pont akkor lenne
halott, amikor kellene.

**A 99 USD/év pedig aránytalan.** Nem üzleti termék; két ember használja otthon. Az évi díj a
projekt teljes költségvetésének többszöröse lenne (a Hetzner-szerver amúgy is megvan, más miatt).

**Az Xcode hiánya megerősíti, de nem ez dönt.** Telepíthető lenne. A lejárat és a díj viszont
strukturális, nem egyszeri akadály.

**Amit a PWA-val elveszítünk, itt nem fáj.** Nincs szükség widgetre, Live Activityre vagy
háttérfutásra: a rögzítés mindig tudatos, aktív mozdulat — az ember előveszi a telefont és
megnyomja, hogy „most kezdődött a fürdés". Ez pont az a használati mód, amiben a PWA nem marad el
a natívtól.

**Ráadásul egyetlen artefakt lesz**: a frontend és a backend ugyanabból a konténerből megy ki
(lásd [egy konténeres deploy](/decisions/2026-07-27-egy-konteneres-deploy.md)), így nincs
verzióeltérés a kliens és a szerver között — a `git push` után mindkét telefon a következő
indításnál az új verziót kapja.

# Következmények

- **A képességkeret az iOS Safarié.** Minden feature-tervet a
  [iOS Safari PWA](/integrations/ios-safari-pwa.md) oldalon lévő korláttáblához kell mérni.
  A legfontosabb: **nincs Background Sync**, tehát a szinkron csak akkor futhat, ha az app
  előtérben van.
- **A telepítés kézi és elmagyarázandó.** Az iOS-en nincs `beforeinstallprompt`, nincs telepítés-gomb.
  Ezért kell a [telepítési útmutató](/workflows/telepites-iphone-ra.md).
- **HTTPS kötelező.** Service worker és a manifest csak biztonságos kontextusban működik. Ez a
  Coolify-nál nyitott kérdést vet fel — lásd [Coolify + Hetzner](/integrations/coolify-hetzner.md).
- **Ha később mégis natív kell** (pl. Live Activity a stopperhez a zárolt képernyőn), a
  React-kód nagy része átvihető Expóba, de a service worker és a manifest eldobandó, és a
  fizetős fiók akkor elkerülhetetlenné válik. Ez a döntés akkor kap `deprecated` jelölést és
  egy utódot.
