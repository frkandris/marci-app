---
type: Integration
title: iOS Safari PWA — képességek és korlátok
description: Mit tud és mit nem a kezdőképernyőre tett webapp iOS-en; ez a tábla adja a feature-tervek kereteit.
tags: [ios, pwa, safari, platform, constraints]
status: stable
generated: { by: "anthropic/claude-opus-5", at: "2026-07-27T19:00:00Z" }
stale_after: 2026-12-31
---

> **Figyelem a frissességre.** Ez a lap a modell 2026-05-ös tudásvágásáig terjedő ismereteket
> rögzíti. Az iOS PWA-támogatás történelmileg **gyorsan és néha visszafelé** változik. Az
> implementáció megkezdésekor a `⚠️` jelölt sorokat **ellenőrizd le** az aktuális iOS-en, mielőtt
> feature-t építesz rájuk. A `stale_after` ezért 2026-12-31.

# Miért ez a legfontosabb integrációs lap

Mert ez adja a **korlátokat**, amikbe minden feature bele kell férjen. A
[PWA-döntés](/decisions/2026-07-27-pwa-nativ-ios-helyett.md) elfogadta ezt a keretet; itt van
kifejtve, hogy pontosan mi az.

# A tábla

| Képesség | iOS-en | Következmény erre a projektre |
|---|---|---|
| Kezdőképernyőre tétel, teljes képernyős mód | ✅ Safari → Megosztás → „Kezdőképernyőhöz adás". `display: standalone` | Ez az egész terjesztési modell alapja |
| Service Worker | ✅ | Offline betöltés, cache — a `vite-plugin-pwa` intézi |
| IndexedDB | ✅ | A lokális igazságtár helye |
| **Background Sync API** | ❌ **Nincs** | **A szinkron csak előtérben futhat.** Ezért indul appindításkor, `visibilitychange`-nél és `online`-nál — lásd [szinkronizáció](/features/szinkronizacio.md) |
| Periodic Background Sync | ❌ Nincs | Nincs időzített háttérfrissítés |
| `beforeinstallprompt` | ❌ Nincs | **Nincs „Telepítés" gomb.** A telepítés kézi, elmagyarázandó — [útmutató](/workflows/telepites-iphone-ra.md) |
| Web Push | ⚠️ iOS 16.4-től, **csak kezdőképernyős** webappnál, felhasználói gesztusból kért engedéllyel | Jelenleg **nem tervezünk** push-t. Ha valaha kell (pl. „12 órája fut egy tevékenység"), ez az út |
| Wake Lock API | ⚠️ iOS 16.4-től | Ha kell, hogy ne aludjon el a képernyő stopper közben |
| Web Share API | ✅ | Ha valaha exportálni akarunk |
| Vibration API | ❌ Nincs | Haptikus visszajelzésre ne építs |
| Képernyő-orientáció zárolása | ❌ Nincs | A layout legyen mindkét irányban használható |
| `100dvh` / `100svh` | ✅ iOS 15.4-től | **Használd ezt, ne `100vh`-t** — lásd lentebb |
| `env(safe-area-inset-*)` | ✅ `viewport-fit=cover` mellett | Kötelező, különben a home indicator alá csúszik a UI |

# A hét csapda, amit előre tudni kell

**1. `100vh` hazudik.** iOS-en a `100vh` a *böngészősáv nélküli* magasságot jelenti, ezért a
tartalom alja levágódik. Használj `100dvh`-t (dinamikus) vagy `100svh`-t (a legkisebb biztos
magasság). Egy fixen a képernyő aljára tapasztott gyorsrögzítő sávnál ez azonnal látszik.

**2. A safe area nem opcionális.** `<meta name="viewport" content="... viewport-fit=cover">` +
`padding-bottom: env(safe-area-inset-bottom)` az alsó sávon, különben a home indicator eltakarja a
gombokat. Ez egy olyan app, amit egy kézzel, sietve nyomkodnak — a legalsó gombsáv kritikus.

**3. Az ikont kézzel kell megadni.** A `manifest.webmanifest` `icons` mezője önmagában
történelmileg **nem volt elég** iOS-en; kell egy `<link rel="apple-touch-icon" href="...">` is,
**180×180 PNG**, átlátszóság nélkül (az iOS nem vág ki alfát, feketére renderel). Splash
képernyőhöz `apple-touch-startup-image` kellene, méretenként külön — ez opcionális, kihagyható.

**4. A kezdőképernyős példány külön tárterületen él.** Ne feltételezd, hogy ami a Safariban
megvan (süti, `localStorage`, IndexedDB), az a kezdőképernyős appban is ott van. **És fordítva.**
Ha teszteléskor Safariban nézed, más adatot látsz, mint az ikonról indítva — ez órákat tud elvinni,
ha nem tudsz róla.

**5. ⚠️ Az ikon törlése törli az adatot.** Ha valaki leszedi a kezdőképernyőről az appot, a
lokális tárolója **elveszik**. Offline-first appnál ez valós adatvesztési kockázat: ami még nem
szinkronizált fel, az odavan. Két védekezés: (a) szinkronizálj agresszívan, ne kötegelj sokáig,
(b) a UI mutassa, ha van fel nem töltött változás. Ugyanez vonatkozik az ITP-re: a Safari
tárterület-kiürítése a kezdőképernyős appokat általában **nem** érinti a 7 napos szabály szerint,
de lemeznyomás alatt továbbra is ürülhet. Hívd meg a `navigator.storage.persist()`-et — best
effort, de ingyen van.

**6. A service worker frissítése nem magától értetődő.** A telepített PWA a régi bundle-t
futtatja, amíg a service worker le nem cseréli magát. Kell egy explicit frissítési folyamat:
`skipWaiting` + a felhasználónak szóló „új verzió elérhető, újratöltés" jelzés. Enélkül egy
`git push` után a telefonok napokig a régi kódot futtathatják. Ezt súlyosbítja, hogy az
`index.html`-nek `no-cache` fejlécet kell kapnia — lásd
[egy konténeres deploy](/decisions/2026-07-27-egy-konteneres-deploy.md).

**7. HTTPS kötelező.** Service worker, manifest és a legtöbb modern API csak biztonságos
kontextusban működik. `localhost` fejlesztéskor kivétel; a **publikus IP HTTP-n nem az.** Ez a
[Coolify-nál nyitott kérdés](/integrations/coolify-hetzner.md).

# Érintés és húzogatás

A [napi idővonal](/features/napi-idovonal.md) húzogatása a legkényesebb interakció, és iOS-en
néhány dolgot kifejezetten le kell tiltani:

```css
.timeline-handle {
  touch-action: none;          /* különben a böngésző görgetésnek értelmezi a húzást */
  user-select: none;           /* különben szövegkijelölés indul */
  -webkit-user-select: none;
  -webkit-touch-callout: none; /* különben hosszú nyomásra megjelenik a rendszermenü */
}
.timeline-scroll {
  overscroll-behavior: contain; /* különben a rubber-band a teljes oldalt húzza */
}
```

Az érintési célpont **legalább 44×44 pt** legyen (Apple HIG) — a húzófogantyú vizuálisan lehet
vékony, de a `::before` pseudo-elemmel felnagyított találati területe nem.

# Amit ez a lap nem fed le

- A natív alternatívák összehasonlítását — az a
  [PWA-döntésben](/decisions/2026-07-27-pwa-nativ-ios-helyett.md) van.
- ⚠️ **Platformkockázat:** a kezdőképernyős webappok támogatottsága szabályozói és üzletpolitikai
  okokból korábban is került veszélybe. Ez nem technikai kérdés, és nem tudunk ellene tenni, de
  érdemes tudni, hogy a terjesztési modell nem Apple-től független.
