---
type: Runbook
title: Szinkronhiba-elhárítás
description: Ha a két telefon nem ugyanazt mutatja — a diagnózis sorrendje.
tags: [ops, sync, runbook, troubleshooting]
status: stable
generated: { by: "anthropic/claude-opus-5", at: "2026-07-27T20:15:00Z" }
---

> Az online-only modell óta a legtöbb korábbi tünet tárgytalan — lásd [online-only](/decisions/2026-07-27-online-only.md).

# Tünet: „A másik telefonon nem látszik, amit rögzítettem"

**A diagnózis sorrendje számít** — a leggyakoribb és legolcsóbban ellenőrizhető okkal kezdd.

**1. Előtérbe került-e a másik telefon az írás óta?**
iOS-en **nincs Background Sync**: a szinkron csak akkor fut, ha az app előtérben van. Ha a másik
telefonon be volt zárva az app, **ez a normális működés**, nem hiba. Nyisd meg, és jelenjen meg.
Lásd [szinkronizáció](/features/szinkronizacio.md).

**2. Van-e függőben lévő változás az író telefonon?**
Ha a UI jelzi, hogy van fel nem szinkronizált módosítás, akkor az adat még **el sem hagyta** az
első telefont. Ellenőrizd a hálózatot rajta, majd hozd előtérbe az appot.

**3. Él-e a szerver?**

```bash
curl -i https://marci.kozossegek.com/api/health
```

**4. Megvan-e az adat a szerveren?**

```bash
docker exec <container> sqlite3 /data/marci.db \
  "SELECT id, datetime(at/1000,'unixepoch','localtime') AS at, activity_id, device_id, seq
   FROM markers ORDER BY seq DESC LIMIT 20;"
```

Ha itt szerepel a marker, a probléma a **letöltő** oldalon van (5. pont). Ha nem, a **feltöltő**
oldalon (2. pont).

**5. Mi a fogadó telefon kurzora?**
A `lastSeq` az IndexedDB `meta` store-jában van. Ha ez **nagyobb**, mint a keresett marker `seq`-e,
akkor a kliens azt hiszi, már látta — és soha nem fogja lekérni.

# Tünet: „Eltűnt egy módosítás"

Ha mindkét telefonon **offline** módosították ugyanazt a markert, a későbbi `edited_at` a
**teljes** rekordot felülírja — mezőnkénti merge nincs. Ez **tervezett viselkedés**, nem hiba:
lásd [offline-first döntés](/decisions/2026-07-27-offline-first-lww-szinkron.md).

Ellenőrzés:

```bash
docker exec <container> sqlite3 /data/marci.db \
  "SELECT id, datetime(edited_at/1000,'unixepoch','localtime') AS edited, device_id, seq
   FROM markers WHERE id = '<marker-id>';"
```

A `device_id` megmutatja, melyik telefon módosítása nyert.

# Tünet: „A két telefon MÁS végállapotot mutat, ugyanazon a kurzoron"

**Ez viszont valódi bug**, nem elfogadott korlát. Az LWW ígérete az, hogy azonos bemenetből azonos
végállapot jön ki. Ha ez sérül, a leggyanúsabb a **holtversenytörés hiánya**: azonos `edited_at`
esetén a `device_id` lexikografikus összehasonlítása dönt, és ha ez kimaradt az implementációból,
a végeredmény a feldolgozási sorrendtől függ.

```bash
docker exec <container> sqlite3 /data/marci.db \
  "SELECT id, COUNT(*) FROM markers GROUP BY id HAVING COUNT(*) > 1;"   # duplikált id?
```

Ha ez előfordul, **írj róla [bug-postmortemet](/bugs/index.md)** — az LWW-invariáns sérülése
osztályhiba, ami visszatér.

# Végső eszköz: a kliens újraszinkronizálása nulláról

Ha egy telefon állapota menthetetlenül elcsúszott:

1. **Ellenőrizd, hogy nincs függőben lévő változás rajta** — ez a lépés kihagyhatatlan, mert a
   következő lépés **eldobja a lokális adatot**.
2. Töröld az appot a kezdőképernyőről, majd tedd vissza
   ([telepítési útmutató](/workflows/telepites-iphone-ra.md)).
3. Az első indításnál `lastSeq = 0`, és a teljes történet letöltődik.

Ez a művelet **új `device_id`-t** generál, tehát a régi eszközazonosító a korábbi markerekben
marad. Ez nem okoz hibát, de a „melyik telefon rögzítette" statisztika ettől megtörik.
