---
type: Source
title: Tervezői beszélgetés — Marci időmérő app
description: A követelmények és a platformválasztás első megfogalmazása, a felhasználó szavaival.
tags: [source, requirements]
generated: { by: "human:frkandris", at: "2026-07-27T17:50:00Z" }
---

> **Forrás, nem wiki-oldal.** Ez az anyag azt rögzíti, ami elhangzott. Nem javítjuk és nem
> frissítjük — ha elavul, a belőle készült wiki-oldalak frissülnek. Lásd
> [assets/](/assets/index.md).

# A követelmény, ahogy elhangzott

> „egy iphone app-ot szeretnék, ami a következő tudja - egy kisfiúnak, marcinak az időtöltéseit
> szeretnénk mérni, hogy mi mennyi ideig tartott, pl. elkezdődött a vacsora, véget ért a vacsora,
> elkezdődött a fürcsi, véget ért a fürcsi, elkezdődött az altatás, elaludt, felébredt stb. szóval
> ilyen átmenetek vannak, valami véget ér, és valami következő kezdődik. szeretném, ha tudnánk
> valami timeline-on húzogatni ezeket az időpontokat utólag is (hoppá, mégsem aludt el), és lehetne
> naponta egymás alatt látni, színkódolva lehetnének az egyes mentett tevékenységek. két telefonra
> szeretném telepíteni ezt. van egy coolify-menedzselte hetzner szerverem backendnek. nem akarom
> app store-ba kitenni, csak itthon használnánk."

## Ami ebből közvetlenül adatmodell-döntés lett

- **„ilyen átmenetek vannak, valami véget ér, és valami következő kezdődik"** → ez a mondat vezetett
  a [határjelölő adatmodellhez](/decisions/2026-07-27-hatarjelolo-adatmodell.md) intervallumok helyett.
- **„timeline-on húzogatni ezeket az időpontokat utólag is"** → a
  [napi idővonal](/features/napi-idovonal.md) központi szerepe.
- **„naponta egymás alatt látni, színkódolva"** → a
  [többnapos áttekintés](/features/tobbnapos-attekintes.md), és rajta keresztül a
  [logikai napkezdet](/decisions/2026-07-27-logikai-napkezdet.md) kérdése.
- **„nem akarom app store-ba kitenni"** + **„két telefonra"** → a terjesztés lett a fő kényszer,
  nem a funkcionalitás → [PWA-döntés](/decisions/2026-07-27-pwa-nativ-ios-helyett.md).
- **„coolify-menedzselte hetzner szerverem"** → [Coolify + Hetzner](/integrations/coolify-hetzner.md).

# A három explicit választás

Feltett kérdésekre adott válaszok, ugyanezen a napon:

| Kérdés | Választás | Hova vezetett |
|---|---|---|
| Platform | **PWA** (kezdőképernyőre tett webapp) | [döntés](/decisions/2026-07-27-pwa-nativ-ios-helyett.md) |
| Offline | **Offline-first** | [döntés](/decisions/2026-07-27-offline-first-lww-szinkron.md) |
| Hitelesítés | **Semmi, nyílt** — a megosztott jelszó javaslata ellenére | [döntés](/decisions/2026-07-27-nincs-hitelesites.md) |

A hitelesítésnél a kockázat ismertetve lett; a felhasználó ennek tudatában választotta a nyílt
backendet.

# Amit a felderítés hozzátett

A fejlesztői gép állapota, 2026-07-27:

```
Node v26.5.0, npm 11.17.0
xcodebuild: 'requires Xcode' — csak Command Line Tools van telepítve
gh CLI: nincs telepítve
```

A repo (`github.com/frkandris/marci-app`): létrehozva, **teljesen üres, nulla commit**.

Korábbi Claude Code transcript ehhez a projekthez: **csak a mostani session** — nem volt mit
bányászni korábbi munkamenetekből.

# A Coolify-példány

Ugyanezen a napon megadva és böngészőből ellenőrizve:

```
http://157.180.21.144:8000   —  Coolify v4.1.2, Root Team
```

Az API-tokenek keresése közben derült ki, hogy a felület megtévesztő: **nincs „Security"
menüpont**, a tokenek a **„Keys & Tokens"** alatt vannak, miközben a megnyíló lap fejléce
„Security". Részletek: [Coolify + Hetzner](/integrations/coolify-hetzner.md).

**A példány titkosítatlan HTTP-n fut publikus IP-n.** Ez két, egymástól független problémát
okoz — az API-token cleartext-utaztatását és azt, hogy a PWA egyáltalán nem telepíthető —,
és jelenleg a projekt egyetlen blokkoló nyitott kérdése. Lásd [faq.md](/faq.md).
