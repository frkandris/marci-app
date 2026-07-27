---
type: Bug Postmortem
title: A confirm() befagyasztotta az egész appot
description: A service worker frissítési kérdése natív confirm() volt, ami blokkolta a renderert — és minden böngészőautomatizálást is.
tags: [pwa, service-worker, ui, postmortem]
status: stable
generated: { by: "anthropic/claude-opus-5", at: "2026-07-27T23:10:00Z" }
---

# Tünet

Az app betöltött, az adatok megérkeztek, aztán **a lap teljesen reagálásképtelenné vált**.
Semmilyen böngészőművelet nem futott le rajta: a képernyőkép-készítés, a szövegkinyerés és még a
navigáció is időtúllépéssel elszállt, mindig ugyanazzal az üzenettel — *„a lap foglalt vagy
mid-navigation"*.

Több kört elvitt a hibás nyomkövetés: gyanúba került a CSS layout (körkörös
`min-height:100%` → `flex:1` → `grid-fr` magasságfüggés) és egy React-végtelenciklus is.
Egyik sem volt igaz.

# Gyökérok

A service worker frissítési folyamata **natív `confirm()`-ot** használt:

```js
// web/src/main.tsx — a hibás változat
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('Új verzió érhető el. Újratöltöd?')) void updateSW(true);
  },
});
```

A `confirm()` (és az `alert()`, `prompt()`) **szinkron módon blokkolja a lap teljes futását**,
amíg a felhasználó nem válaszol. Nem csak a JavaScript áll meg: az események, az időzítők, a
rajzolás és a külső eszközök szkriptinjektálása is.

A csapdát az zárta be, hogy **a dialógus pont akkor jelent meg, amikor új build került ki** —
vagyis minden egyes alkalommal, amikor ellenőrizni akartam a friss változtatásaimat. A tünet így
elválaszthatatlannak tűnt attól, amit épp módosítottam.

**A hibát végül a felhasználó azonosította**, aki ránézett a képernyőre és leírta, mi látszik:
„azt kérdezi popupban, h új verzió érhető el, újratöltöd-e". Egyetlen mondat, ami órákat spórolt
volna meg az elején.

# Javítás

A natív dialógus helyére az app **saját felületi sávja** került, ami nem blokkol semmit:

```tsx
// main.tsx
const updateSW = registerSW({
  onNeedRefresh() { setUpdateAvailable(() => void updateSW(true)); },
});

// App.tsx
{s.updateReady && (
  <div className="banner banner--update">
    <span>Új verzió érhető el.</span>
    <button onClick={applyUpdate}>Frissítés</button>
  </div>
)}
```

Ez ráadásul jobb is: illeszkedik a felület stílusához, nem szakítja meg a munkát, és a
felhasználó akkor frissít, amikor neki jó.

# Tanulság

**`alert()`, `confirm()` és `prompt()` nem használható ebben a projektben.** Nem stílusbeli
kérdés: a natív dialógus blokkolja a renderert, és ezzel minden mást is — beleértve azt, amivel
a hibát keresnéd.

Két általánosítható pont:

1. **Ha a diagnosztikai eszközöd is elhal, gyanakodj a blokkoló dialógusra.** A „lap foglalt"
   típusú hibaüzenet nem feltétlenül végtelenciklust jelent.
2. **Nézz rá a képernyőre, mielőtt elméletet gyártasz.** Két hipotézist is végigvittem (CSS
   layout, React-ciklus), amiket egyetlen pillantás cáfolt volna.

A megerősítő párbeszédek amúgy is kerülendők ebben az appban — a
[gyorsrögzítés](/features/gyorsrogzites.md) tudatosan **visszavonást** kínál helyettük, mert
egy naponta sokszor használt művelet nem drágulhat meg egy kérdéssel.
