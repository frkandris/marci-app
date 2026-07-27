---
type: Decision
title: Egy konténer, egy domain — a backend szolgálja ki a frontendet
description: A Hono szerver adja ki a Vite statikus buildjét is; nincs külön frontend-service és nincs CORS.
tags: [deploy, docker, coolify, architecture]
status: stable
generated: { by: "anthropic/claude-opus-5", at: "2026-07-27T18:50:00Z" }
---

# Kontextus

A projektnek van egy React PWA-ja (statikus fájlok) és egy Node API-ja. A Coolify mindkettőt tudná
külön szolgáltatásként kezelni, saját domainnel.

# Mérlegelt opciók

| Opció | Mellette | Ellene |
|---|---|---|
| **Két Coolify-service** (statikus site + API) | A frontend CDN-szerűen szolgálható ki. Külön skálázható. | Két domain vagy path-alapú routing → **CORS**. Két deploy, ami elcsúszhat egymástól. Két tanúsítvány. Kétszer annyi hibalehetőség. |
| **Egy konténer, a Node szolgálja ki mindkettőt** | Egy domain, **nincs CORS**. A frontend és a backend verziója **nem tud elcsúszni**. Egy deploy, egy healthcheck, egy tanúsítvány. | A statikus kiszolgálás Node-on kicsit lassabb, mint nginxen. Nem külön skálázható. |

# Döntés

**Egy Docker-image, egy futó konténer, egy port (3000), egy domain.** A Hono a `/api/*` útvonalakat
kezeli, minden más kérésre a Vite `dist/` tartalmát szolgálja ki, ismeretlen útvonalra pedig az
`index.html`-t (SPA-fallback).

Multi-stage Dockerfile: az első fázis buildeli a `web/`-et, a második telepíti a `server/`
függőségeit, a végső image csak a futtatáshoz kell holmit tartalmazza.

# Miért

**A CORS elkerülése önmagában megéri.** Nem a konfiguráció nehéz, hanem az, hogy a service worker,
a manifest scope-ja és a `fetch` hitelesítési módja mind ugyanarra az origin-fogalomra épül.
Azonos originnél ez az egész kérdéskör meg sem jelenik — a PWA úgy viselkedik, ahogy a
legegyszerűbb mentális modell szerint várnánk.

**A verzióelcsúszás valós veszély egy PWA-nál.** A service worker agresszíven cache-el; ha a
frontend külön deployolódik, könnyen előáll, hogy egy telefon régi JS-t futtat egy már
megváltozott API ellen. Egy artefaktnál ez lehetetlen: ami kiment, az egyben ment ki.

**A teljesítménykülönbség itt zajszint.** Két felhasználó, néhány tucat kérés naponta. Az nginx
statikus kiszolgálásának előnye ekkora terhelésnél nem mérhető.

**A Coolify-nak is ez a legegyszerűbb.** Egy alkalmazás, Dockerfile build pack, egy exposed port,
egy FQDN, egy volume, egy healthcheck. Minden további service duplázná a konfigurálandó felületet
— és ezt a szervert nem üzemeltető szakember gondozza napi szinten.

# Következmények

- **A `server/` futásidőben függ a `web/dist` meglététől.** A Dockerfile sorrendje kötött: előbb a
  frontend build, aztán a másolás. Ha a build fázis csendben elhasal, a szerver elindul, de csak
  404-et ad — ezért a healthcheck **ne csak a `/api/health`-et nézze**, hanem az `index.html`
  elérhetőségét is.
- **Fejlesztéskor viszont két folyamat fut** (Vite dev szerver + Node API), és ott *van* origin-eltérés.
  Ezt a Vite `server.proxy` beállítása oldja meg — a `/api` proxyzva a Node-ra —, nem CORS-fejlécek.
  Így a fejlesztői és az éles környezet azonos origin-modellt lát. Lásd
  [fejlesztői környezet](/workflows/fejlesztoi-kornyezet.md).
- **Az SPA-fallback nem eshet rá az `/api/*`-ra.** A route-sorrend számít: előbb az API, aztán a
  statikus, végül a fallback. Fordított sorrendnél az API 404-jei `index.html`-t adnának vissza
  200-zal, ami a kliensen JSON-parse hibaként jelentkezne — megtévesztő hibakép.
- **A statikus assetek cache-fejléceit kézzel kell beállítani**: a hash-elt nevű bundle-ök
  `immutable, max-age=31536000`, az `index.html`, a `manifest.webmanifest` és a service worker
  viszont `no-cache`. Ha az `index.html` cache-elődik, a telefonok a régi bundle-re mutató
  HTML-t kapnák, és a frissítés nem érne célba.
