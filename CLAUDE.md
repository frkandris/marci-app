# Marci időmérő

Kétfelhasználós PWA egy kisgyerek napi időtöltéseinek rögzítésére. Két iPhone, saját Hetzner-szerver
Coolify alatt, App Store nélkül.

## Projekt-tudásbázis — `wiki/`

A `wiki/` egy LLM által karbantartott tudásbázis erről a projektről. Azt tartalmazza, amit a kód
önmagában nem mutat meg: architekturális minták, döntések **és azok indoklása**, hibaboncolások,
ismert hackek és vállalt adósság, integrációs szerződések, runbookok és a szakszótár.

**Minden nem triviális feladat előtt, a munka megkezdése előtt:**

- Olvasd el a [`wiki/CLAUDE.md`](wiki/CLAUDE.md)-t — ez a séma. Megmondja, mikor kell a wikit
  frissíteni és hogyan kell oldalt írni. A „Mikor kell frissíteni" listát kezeld az aktuális
  feladatra vonatkozó **ellenőrzőlistaként**.
- Fusd át a [`wiki/index.md`](wiki/index.md)-t — ez a tartalomtérkép. Keresd meg és olvasd el az
  általad érintett területhez tartozó oldalakat. A wiki a leggyorsabb út ahhoz a kontextushoz,
  amit korábbi munkamenetek órák alatt építettek fel.

**Munka közben:**

- Ha döntés születik, nem triviális bug javul, hack kerül be, integráció változik, szakkifejezés
  merül fel, vagy incidenst hárítasz el — hozd létre vagy frissítsd a megfelelő wiki-oldalt a séma
  szerint, és fűzz egy egysoros bejegyzést a [`wiki/log.md`](wiki/log.md)-be.
- **A wiki-frissítés ugyanabba a commitba (vagy PR-be) megy, mint a kódváltozás, ami kiváltotta** —
  így a `git log` összeköti a kettőt.
- A wiki ki van zárva a formázóból (`.prettierignore`) és nem tartozik semmilyen build-projekthez.

**Új feature-höz:**

A [`wiki/architecture.md`](wiki/architecture.md) tartalmaz egy végigvezetett, végponttól végpontig
tartó példát, ami bemutatja a rétegzett mintát, amit minden új feature követ. Használd sablonként.

## ⚠️ A projekt jelenlegi állapota

**2026-07-27-én a repóban nincs kód.** A wiki architektúra- és feature-oldalai **tervet** írnak le,
`status: draft` jelöléssel. A döntés-oldalak viszont valódiak és `stable`.

Amikor egy terv kóddá válik, a [`wiki/CLAUDE.md`](wiki/CLAUDE.md) állapotszakasza leírja, mit kell
ugyanabban a commitban frissíteni — a `draft` → `stable` váltást, a banner törlését, és a valós
`file:line` hivatkozások behelyezését.

## Nyelv

A wiki és a felhasználóval folytatott kommunikáció **magyarul** megy. A szakkifejezések,
azonosítók, parancsok és mezőnevek maradnak eredeti alakban (`service worker`, `IndexedDB`,
`edited_at`) — ezeket ne magyarítsd.

## Környezet

| | |
|---|---|
| Az app domainje | **`https://marci.kozossegek.com`** (Cloudflare → Hetzner, Coolify/Traefik) |
| Coolify felülete | `http://157.180.21.144:8000` — ⚠️ HTTP, ezért **API-tokent ne adj ki** |

Részletek: [`wiki/integrations/coolify-hetzner.md`](wiki/integrations/coolify-hetzner.md).
