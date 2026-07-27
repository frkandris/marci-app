---
type: Runbook
title: Mentés és visszaállítás
description: Az SQLite-fájl helyes mentése, automatizálása, és mit tegyél, ha üres az adatbázis.
tags: [ops, backup, sqlite, runbook]
status: stable
generated: { by: "anthropic/claude-opus-5", at: "2026-07-27T20:10:00Z" }
---

> A parancsok a most élő elrendezésre vonatkoznak. A volume neve `yo75ku697v37lvjaotkrmwra-marci-data`, a mountpont `/data`.

# Miért fontos ez jobban, mint amennyire látszik

Minden adat **egyetlen fájlban** van: `/data/marci.db`. Ez a mentést triviálissá teszi — és ez
volt az [SQLite-döntés](/decisions/2026-07-27-sqlite-adattar.md) egyik érve —, de azt is jelenti,
hogy egyetlen hiba mindent elvisz.

# ⚠️ `cp`-vel NE ments

Az adatbázis WAL módban fut, tehát három fájl tartozik hozzá: `marci.db`, `marci.db-wal`,
`marci.db-shm`. Egy `cp marci.db` **futó rendszeren sérült vagy hiányos** másolatot ad, mert a
legfrissebb tranzakciók még a WAL-ban vannak.

**Helyesen:**

```bash
docker exec <container> sqlite3 /data/marci.db ".backup '/data/backup-$(date +%F).db'"
```

A `.backup` az SQLite online backup API-ját használja: konzisztens pillanatképet ad **futás
közben, leállítás nélkül**.

# Mentés kimásolása a szerverről

```bash
# a szerveren
docker exec <container> sqlite3 /data/marci.db ".backup '/data/backup-$(date +%F).db'"

# a saját gépről
scp <user>@157.180.21.144:/var/lib/docker/volumes/<volume>/_data/backup-*.db ./
```

A pontos volume-útvonal a Coolify-ból derül ki:

```bash
docker inspect <container> --format '{{json .Mounts}}' | jq
```

# Automatizálás

Egy napi cron a szerveren bőven elég ekkora adathoz:

```cron
0 3 * * * docker exec <container> sqlite3 /data/marci.db \
  ".backup '/data/backup-$(date +\%F).db'" && \
  find /var/lib/docker/volumes/<volume>/_data -name 'backup-*.db' -mtime +30 -delete
```

**Szerveren kívüli másolat is kell.** Ha a Hetzner-gép elvész, a rajta lévő mentés is elvész.
A Coolify **S3 Storages** menüpontja beépített célpontokat ad ehhez — lásd
[Coolify + Hetzner](/integrations/coolify-hetzner.md).

# Visszaállítás

```bash
# 1. Állítsd le az appot a Coolify-ból (hogy ne írjon közben)
# 2. A jelenlegi állapotot MENTSD EL, mielőtt felülírnád — akkor is, ha rossznak hiszed
docker exec <container> cp /data/marci.db /data/marci.db.before-restore
# 3. Írd felül
docker exec <container> cp /data/backup-2026-07-27.db /data/marci.db
docker exec <container> rm -f /data/marci.db-wal /data/marci.db-shm
# 4. Indítsd el az appot
# 5. Ellenőrizd
docker exec <container> sqlite3 /data/marci.db "SELECT COUNT(*) FROM markers;"
```

A 2. lépés nem óvatoskodás: ha a visszaállítás rossz mentésből történik, a 2. lépés nélkül az
**eredeti állapot is elveszett**, és nincs visszaút.

# 🔴 „Üres az adatbázis deploy után"

**Ez a legvalószínűbb incidens ebben a projektben, és majdnem mindig ugyanaz az oka.**

Tünet: a deploy sikeres, az app működik, de **minden korábbi adat eltűnt**.

**Először ne az adatbázist nézd, hanem a volume-ot:**

```bash
docker inspect <container> --format '{{json .Mounts}}' | jq
```

Ha a `/data` **nem jelenik meg mountként**, akkor az adatbázis a konténer írható rétegében volt,
és a redeploy megsemmisítette. Ez nem javítható visszamenőleg — az adat **nincs meg**.

**Teendő:**
1. Állítsd be a perzisztens storage-t a `/data`-ra a Coolify-ban.
2. Ellenőrizd újra a mount meglétét, **mielőtt** bármi valódi adat kerül bele.
3. Ha van korábbi mentés vagy egy telefon, ami régóta nem szinkronizált, onnan visszahozható:
   **a telefonok IndexedDB-je teljes lokális másolatot tart.** Ez a projekt informális
   végső mentése — ha ez megtörténik, **először NE indítsd el a telefonokon az appot**, mert egy
   sikeres szinkron a `lastSeq`-kurzort az üres szerverhez igazíthatja.

Ha ez megtörtént, írj róla egy [bug-postmortemet](/bugs/index.md).
