---
type: Integration
title: Coolify + Hetzner — a deploy-célpont
description: A konkrét Coolify-példány, a deploy-szerződés, a volume, az API-token útvonala és a HTTPS-figyelmeztetés.
tags: [deploy, coolify, hetzner, ops, security]
status: stable
generated: { by: "anthropic/claude-opus-5", at: "2026-07-27T19:10:00Z" }
verified: { by: "anthropic/claude-opus-5", at: "2026-07-27T19:05:00Z" }
stale_after: 2026-12-31
sources:
  - id: coolify-ui
    resource: http://157.180.21.144:8000/security/api-tokens
    title: A Coolify-példány felülete, böngészőből megtekintve
    author: human:frkandris
    last_modified: 2026-07-27
  - id: coolify-docs
    resource: https://coolify.io/docs
    title: Coolify hivatalos dokumentáció
---

# A példány

| | |
|---|---|
| Coolify felülete | `http://157.180.21.144:8000` — ⚠️ HTTP |
| Coolify verzió | **v4.1.2** |
| Csapat | Root Team |
| Szerver | Hetzner, `157.180.21.144` |
| **Az app domainje** | **`marci.kozossegek.com`** — HTTPS, Cloudflare mögött |

Ezek 2026-07-27-én, a felület közvetlen megtekintésével és a domain lekérdezésével ellenőrzött
adatok, nem feltételezések.

# A domain — ellenőrzött állapot

2026-07-27-én mérve:

```
$ dig +short marci.kozossegek.com A
172.67.170.128
104.21.87.180                    ← Cloudflare, nem a Hetzner IP

$ curl -I https://marci.kozossegek.com
HTTP/2 404
content-type: text/plain; charset=utf-8
content-length: 19               ← "404 page not found" = a Coolify Traefikje
server: cloudflare
```

Amit ez elárul: **a domain Cloudflare-proxyn keresztül megy** (narancs felhő), nem közvetlenül a
Hetznerre. A lánc viszont **végig működik** — a 19 bájtos `text/plain` 404 a Traefik alapértelmezett
válasza, tehát a kérés eljut az origin szerverre. A 404 helyes: még nincs alkalmazás
konfigurálva erre a hosztnévre.

**A PWA HTTPS-követelménye ezzel teljesül**, mert a böngésző felé érvényes tanúsítvánnyal
végződik a TLS. Az app tehát telepíthető lesz iPhone-ra.

## ⚠️ Amit a Cloudflare-proxy miatt ellenőrizni kell

**Az SSL/TLS mód a Cloudflare-ben.** Ha „Flexible", akkor a Cloudflare→origin szakasz
**titkosítatlan HTTP**, és ráadásul a Coolify HTTPS-átirányításával könnyen végtelen
átirányítási hurkot ad. A helyes beállítás **„Full (strict)"**, a Coolify oldalán valódi Let's
Encrypt tanúsítvánnyal.

**A tanúsítvány kiállítása.** A Let's Encrypt HTTP-01 kihívás proxyzott Cloudflare mögött is
átmegy, de ha elakad, a bevált megoldás a rekordot ideiglenesen **„DNS only"-ra** (szürke felhő)
állítani, megvárni a tanúsítványt, majd visszakapcsolni a proxyt.

# ⚠️ Ami továbbra is nyitott: a Coolify felülete HTTP-n

**A domain az appot oldotta meg, a Coolify saját felületét nem.** Az továbbra is
`http://157.180.21.144:8000`, titkosítatlanul, publikus IP-n.

Ennek egyetlen gyakorlati következménye maradt: **egy API-token cleartextben utazna**. Egy `write`
vagy `deploy` jogú Coolify-token birtokában bárki deployolhat a szerverre. Ez **súlyosabb kérdés,
mint a [nincs-hitelesítés döntés](/decisions/2026-07-27-nincs-hitelesites.md)** — ott egy családi
naptáradat a tét, itt maga a szerver.

Amíg ez így van, **ne adj ki API-tokent**. A deployhoz nincs is rá szükség: a GitHub-webhook
önmagában elég.

# API-tokenek — hol vannak valójában

A Coolify felülete itt megtévesztő, és ez okozta a keresést:

- A bal oldali menüben **nincs „Security" nevű pont**.
- Az API-tokenek a **„Keys & Tokens"** menüpont alatt vannak.
- A megnyíló lap fejléce viszont **„Security"** — innen a félreértés.
- Közvetlen útvonal: **`/security/api-tokens`**

A lapon négy fül van: `Private Keys` | `Cloud Tokens` | `Cloud-Init Scripts` | **`API Tokens`**.

**Új token létrehozása:** `Description` (kötelező) + `Expires in` (alapértelmezés: 30 nap) +
`Create`. A jogosultságok jelölőnégyzetei:

| Jog | Mit ad | Kell ehhez a projekthez? |
|---|---|---|
| `root` | Mindent | **Nem.** Soha ne adj rootot egy deploy-tokennek |
| `write` | Erőforrások létrehozása, módosítása | Igen, ha az app létrehozását/konfigurálását API-ból csináljuk |
| `deploy` | Deploy indítása | Igen |
| `read` | Olvasás (alapból bepipálva) | Igen |
| `read:sensitive` | Környezeti változók és titkok olvasása | **Nem.** Ez adná ki a `SHARED_TOKEN`-t és minden más titkot |

**Ajánlás:** `read` + `write` + `deploy`. Root és `read:sensitive` nélkül. És **csak azután**,
hogy a Coolify HTTPS mögé került.

2026-07-27-én a példányon **egyetlen token sem volt kiadva** („No API tokens found").

# A deploy-szerződés

Amit a Coolify-ban be kell állítani, hogy az app működjön. A részletes lépéssor a
[deploy workflow](/workflows/deploy.md)-ban van; itt a szerződés, amit a kódnak teljesítenie kell:

| Amit a Coolify vár | Amit a projekt ad |
|---|---|
| Build pack | **Dockerfile** (nem Nixpacks — a multi-stage build kézben tartása fontos) |
| Exposed port | **3000** |
| Healthcheck | `GET /api/health` → `200`. **Ellenőrizze az `index.html` meglétét is** — lásd [egy konténeres deploy](/decisions/2026-07-27-egy-konteneres-deploy.md) |
| Perzisztens tároló | Volume a **`/data`** útvonalra |
| Környezeti változók | `NODE_ENV=production`, `PORT=3000`, `DB_PATH=/data/marci.db`, opcionálisan `SHARED_TOKEN` |
| FQDN | Kötelező, a HTTPS miatt |

# 🔴 A volume a projekt legveszélyesebb pontja

**Ha a `/data` nincs perzisztens volume-ra kötve, minden redeploy törli az összes adatot.**

Ez azért alattomos, mert **semmi nem jelzi**. Az app elindul, működik, ír, olvas — csak a
konténer írható rétegébe, ami a következő `git push`-nál eltűnik. A hiba nem a deploykor derül ki,
hanem hetekkel később, amikor valaki visszakeres.

Ellenőrzés deploy után, a Coolify Terminal moduljából vagy SSH-val:

```bash
docker exec <container> ls -la /data/
docker inspect <container> --format '{{json .Mounts}}' | jq
```

Ha a `/data` nem jelenik meg mountként, **azonnal állítsd le és javítsd**, mielőtt valódi adat
kerül bele. Lásd még [mentés és visszaállítás](/runbooks/mentes-visszaallitas.md).

# Egyéb, amit a felület mutatott

A bal oldali menü szerkezete v4.1.2-ben: Dashboard, Projects, Servers, Sources, Destinations,
S3 Storages, Shared Variables, Notifications, **Keys & Tokens**, Tags, Terminal, Profile, Teams,
Settings.

- **Sources** — ide kell bekötni a GitHub-ot (GitHub App vagy deploy key), hogy a
  `frkandris/marci-app` privát/publikus repo elérhető legyen.
- **Terminal** — böngészőből futtatható parancsok a szerveren; ez a legegyszerűbb út a
  mentés-ellenőrzéshez SSH nélkül.
- **S3 Storages** — ha valaha automatikus, szerveren kívüli mentést akarunk az SQLite-fájlról,
  a Coolify beépített backup-célpontjai innen jönnek.
- **Notifications** — beállítható értesítés sikertelen deployra. Egy kétfelhasználós appnál is
  megéri: enélkül csak akkor derül ki a törött build, amikor használni akarnád.
