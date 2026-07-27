---
type: Decision
title: Nincs hitelesítés a backenden
description: A felhasználó tudatosan a nyílt backendet választotta a megosztott jelszó helyett; a kockázat és a visszaút itt van rögzítve.
tags: [security, auth, risk]
status: stable
generated: { by: "anthropic/claude-opus-5", at: "2026-07-27T18:40:00Z" }
sources:
  - id: session
    resource: /assets/2026-07-27-terv-beszelgetes.md
    title: Tervezői beszélgetés — auth-választás
    author: human:frkandris
    last_modified: 2026-07-27
---

# Kontextus

A backend publikus interneten fut (Hetzner, Coolify). Három lehetőség került elő, a
kockázat és a felhasználó választása egyértelműen dokumentálandó, mert ez a projekt egyetlen
tudatosan vállalt biztonsági engedménye.

# Mérlegelt opciók

| Opció | Mellette | Ellene |
|---|---|---|
| **Megosztott jelszó / PIN** (ajánlott volt) | Egyetlen konstans összehasonlítás. A telefon megjegyzi, egyszer kell beírni. Kizárja a véletlen és a szkennelt hozzáférést. | Egy plusz képernyő és egy env-változó. |
| **Felhasználónév + jelszó** | Látszik, ki rögzítette az eseményt. | User-tábla, hash-elés, session — aránytalan két emberre. A `device_id` amúgy is megadja a „ki rögzítette" információt. |
| **Semmi, nyílt** ← **választva** | Nulla kód, nulla súrlódás. | Bárki, aki megtalálja az URL-t, **olvashatja és szerkesztheti** egy kisgyerek napi ritmusát. |

# Döntés

**Nincs hitelesítés.** Az API nyílt. A felhasználó ezt a lehetséges kockázat ismertetése után,
tudatosan választotta.

# Miért

Ez a felhasználó döntése, nem technikai levezetés eredménye. A választás melletti érv a
súrlódásmentesség: egy naponta sokszor előkapott app minden extra koppintása valós költség, és a
projekt teljes célja a gyors rögzítés.

**Amit ezzel szemben mérlegre kell tenni, és ami rögzítve marad:**

- Az adat egy **kisgyerek napi rutinja**: mikor alszik, mikor fürdik, mikor van egyedül. Ez
  érzékenyebb, mint amennyire elsőre látszik — nem az adat *értéke*, hanem a *természete* miatt.
- A „nem tudja senki az URL-t" nem védelem. A publikus IP-tartományokat folyamatosan pásztázzák;
  egy nyílt végpontot előbb-utóbb megtalál egy szkenner, akkor is, ha a link sosem került ki sehova.
- Az API **írható** is. Nemcsak kiolvasható az adat, hanem összefirkálható.

Ez nem felülbírálja a döntést — csak azt rögzíti, hogy mi az, amit elfogadtunk.

# Következmények

- **A kód készüljön úgy, hogy a visszaút egy env-változó legyen.** A szerver olvasson egy
  opcionális `SHARED_TOKEN` környezeti változót:

  ```
  SHARED_TOKEN üres vagy hiányzik  →  minden kérés átmegy (a jelenlegi döntés)
  SHARED_TOKEN be van állítva      →  minden /api/* kérés X-Marci-Token fejlécet vár
  ```

  A kliens oldalon ugyanez: ha a token be van állítva, egy egyszeri beviteli képernyő és
  `localStorage`. **Ez a kód menjen bele az első verzióba**, kikapcsolt állapotban. Utólag
  bevezetni sokkal drágább, mert a már telepített két PWA-t is frissíteni kell hozzá.
- **Ne kerüljön ki az URL sehova.** Ne linkeld nyilvános helyre, ne tedd bele publikus repo
  README-jébe, és ne indexeltesd: a szerver küldjön `X-Robots-Tag: noindex` fejlécet, és a
  `/robots.txt` tiltson mindent.
- **Az újraértékelés kiváltó okai** — ha ezek bármelyike bekövetkezik, ez a döntés újranyitandó:
  a szerveren megjelenik más, érzékenyebb szolgáltatás; a linket megosztják valakivel; vagy a
  logokban ismeretlen IP-ről érkező `/api/*` kérések tűnnek fel.
- **A titkosítatlan HTTP külön, súlyosabb kérdés**, és nem ez a döntés fedi le. Lásd
  [Coolify + Hetzner](/integrations/coolify-hetzner.md) — a PWA amúgy is HTTPS-t követel meg a
  service workerhez, tehát az appnak mindenképp TLS mögé kell kerülnie.
