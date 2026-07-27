---
type: Workflow
title: Deploy
description: Egyszeri Coolify-beállítás, majd git push → automatikus build és élesedés.
tags: [deploy, coolify, ops, workflow]
status: draft
generated: { by: "anthropic/claude-opus-5", at: "2026-07-27T20:00:00Z" }
---

> **Állapot: tervezett.** A Coolify-alkalmazás még nincs létrehozva; a példány adatai viszont
> ellenőrzöttek — lásd [Coolify + Hetzner](/integrations/coolify-hetzner.md).

# A domain

**`marci.kozossegek.com`** — a DNS él, Cloudflare-proxyn keresztül eljut a Coolify Traefikjéig.
A HTTPS-előfeltétel ezzel teljesül. Egy dolgot érdemes ellenőrizni: a Cloudflare SSL/TLS módja
legyen **„Full (strict)"**, ne „Flexible" — különben átirányítási hurkot kaphatsz.
[Részletek](/integrations/coolify-hetzner.md).

# Egyszeri beállítás a Coolify-ban

`http://157.180.21.144:8000` → Projects → New Application.

| Beállítás | Érték |
|---|---|
| Source | GitHub → `frkandris/marci-app` (előbb bekötni a **Sources** menüpont alatt) |
| Branch | `main` |
| Build pack | **Dockerfile** (nem Nixpacks) |
| Port | **3000** |
| FQDN | `marci.kozossegek.com` — ez kapcsolja be a Let's Encryptet |
| Healthcheck | `GET /api/health` |
| **Persistent storage** | **volume → `/data`** ← lásd lentebb |

Környezeti változók:

```
NODE_ENV=production
PORT=3000
DB_PATH=/data/marci.db
# SHARED_TOKEN=          ← üresen hagyva: nyílt API (jelenlegi döntés)
```

## 🔴 A volume — ezt ne hagyd ki

**Ha a `/data` nincs perzisztens volume-ra kötve, minden redeploy törli az összes adatot.**

Ez azért veszélyes, mert semmi nem jelzi: az app elindul, ír, olvas — csak a konténer írható
rétegébe, ami a következő `git push`-nál eltűnik. A hiba hetekkel később derül ki.

**Az első deploy után azonnal ellenőrizd**, mielőtt valódi adat kerül bele:

```bash
docker inspect <container> --format '{{json .Mounts}}' | jq
docker exec <container> ls -la /data/
```

Ha a `/data` nem jelenik meg mountként, állítsd le és javítsd.

# A szokásos deploy

```bash
git add -A
git commit -m "..."     # a wiki-frissítés UGYANEBBE a commitba megy
git push
```

A Coolify webhookja elindítja a buildet. Menete: Dockerfile build (web build → server deps →
végső image) → healthcheck → átállás.

# Deploy után

1. **Healthcheck**: `curl https://marci.kozossegek.com/api/health` → `200`
2. **A frontend is kimegy-e**: `curl -I https://marci.kozossegek.com/` → `200`, `content-type: text/html`.
   Ezt azért kell külön nézni, mert a Dockerfile build fázisa **csendben elhasalhat**: a szerver
   elindul, az API válaszol, de a statikus fájlok hiányoznak. Lásd
   [egy konténeres deploy](/decisions/2026-07-27-egy-konteneres-deploy.md).
3. **A telefonok frissülnek-e**: a service worker miatt **nem azonnal**. Kell egy explicit
   frissítési folyamat (`skipWaiting` + „új verzió elérhető" jelzés), különben a telefonok
   napokig a régi kódot futtathatják — lásd [iOS Safari PWA](/integrations/ios-safari-pwa.md).

# Ha elromlik

- **Sikertelen build** → a Coolify build-logja. Érdemes **Notifications**-t beállítani sikertelen
  deployra: enélkül csak akkor derül ki a törött build, amikor használni akarnád.
- **Elindul, de 404** → majdnem biztosan a frontend build nem került be az image-be. Nézd meg a
  Dockerfile másolási lépését és a build fázis kimenetét.
- **Elindult, de üres az adat** → **először a volume-ot nézd**, ne az adatbázist. Lásd
  [mentés és visszaállítás](/runbooks/mentes-visszaallitas.md).

# Amit ez a projekt tudatosan nem csinál

Nincs staging környezet, nincs CI-teszt a deploy előtt, és nincs blue-green átállás. Két
felhasználónál a leállás ára néhány perc; egy teljes CI/CD-lánc karbantartása többe kerülne, mint
amennyit ér. Ha ez valaha megváltozik, ez a lap frissítendő és egy döntés-oldal írandó róla.
