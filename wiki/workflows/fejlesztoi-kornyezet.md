---
type: Workflow
title: Fejlesztői környezet
description: Repo, futtatás, portok, és a Vite-proxy amiért fejlesztéskor sincs CORS.
tags: [dev, setup, workflow]
status: draft
generated: { by: "anthropic/claude-opus-5", at: "2026-07-27T19:55:00Z" }
---

> **Állapot: tervezett.** A `web/` és `server/` mappák még nem léteznek; ez a szándékolt
> elrendezés. Amint a kód létrejön, ez az oldal `stable`-re vált, valós parancsokkal ellenőrizve.

# Repo

```
git clone https://github.com/frkandris/marci-app.git
cd marci-app
```

A gépen ellenőrzött verziók (2026-07-27): **Node v26.5.0**, **npm 11.17.0**. Xcode nincs, és nem
is kell — lásd [PWA-döntés](/decisions/2026-07-27-pwa-nativ-ios-helyett.md).

# Tervezett elrendezés

```
marci-app/
├── CLAUDE.md          # a projekt utasításfájlja — a wikire mutat
├── wiki/              # ez a tudásbázis
├── web/               # React + TS + Vite PWA
├── server/            # Node + Hono + better-sqlite3
├── Dockerfile         # multi-stage: web build → server → futtatás
└── package.json       # npm workspaces: web, server
```

# Futtatás

```bash
npm install            # workspace-ek együtt
npm run dev            # a web és a server párhuzamosan
```

| Folyamat | Port | Mi |
|---|---|---|
| Vite dev szerver | 5173 | A frontend, HMR-rel |
| Node API | 3000 | A Hono, `/api/*` |

**Fejlesztéskor két origin van, élesben egy** — ezt a Vite proxyja hidalja át, **nem CORS-fejlécek**:

```js
// web/vite.config.ts
server: { proxy: { '/api': 'http://localhost:3000' } }
```

Így a böngésző mindkét környezetben ugyanazt látja: minden azonos originről jön. Ez szándékos —
a [egy konténeres deploy](/decisions/2026-07-27-egy-konteneres-deploy.md) origin-modellje
fejlesztéskor is érvényes marad, tehát nem érhet meglepetés élesítéskor.

# Adatbázis fejlesztéskor

```bash
DB_PATH=./dev.db npm run dev
```

A `dev.db` legyen `.gitignore`-ban. Élesben ez `/data/marci.db` a Coolify volume-on.

# A PWA tesztelése

Ez a rész az, ahol a legtöbb idő el tud menni, ha nem tudod előre:

- **A service worker `npm run dev` alatt jellemzően ki van kapcsolva.** Az igazi PWA-viselkedéshez
  `npm run build && npm run preview` kell.
- **iPhone-on teszteléshez HTTPS kell.** A `localhost` kivétel, de a gép LAN-IP-je nem az. Vagy
  egy tunnel (pl. `cloudflared`, `ngrok`), vagy egyenesen a Coolify staging-környezete.
- **A Safari-fül és a kezdőképernyős app KÜLÖN tárterületen él.** Ha Safariban tesztelsz, más
  adatot látsz, mint az ikonról indítva. Ez órákat tud elvinni — lásd
  [iOS Safari PWA](/integrations/ios-safari-pwa.md).
- **Régi service worker beragadása** a leggyakoribb fejlesztési zavar. Safari →
  Beállítások → Speciális → Webhely-adatok, vagy egyszerűen töröld és tedd vissza az ikont.

# Eszközhatárok

- A `wiki/` **ki van zárva a formázóból** (`.prettierignore`) — a próza tördelését ne írja át semmi.
- A `wiki/` **nincs benne** a TypeScript projektben. Amikor a `tsconfig.json` létrejön, az
  `include` ne érje el.
- **A wiki-frissítés ugyanabba a commitba megy, mint a kódváltozás, ami kiváltotta.** Lásd
  [séma](/CLAUDE.md).
