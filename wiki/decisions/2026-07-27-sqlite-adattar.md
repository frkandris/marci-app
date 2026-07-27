---
type: Decision
title: SQLite adattár Postgres helyett
description: Egyetlen SQLite-fájl egy Coolify volume-on; a mentés egy fájlmásolás.
tags: [storage, sqlite, ops]
status: stable
generated: { by: "anthropic/claude-opus-5", at: "2026-07-27T18:45:00Z" }
---

# Kontextus

A szervernek tárolnia kell a markereket és a tevékenységtípusokat. A várható méret nagyságrendje
könnyen becsülhető: napi 10–30 marker, évi ~7 000, rekordonként ~150 bájt → **évi nagyjából 1 MB**.
Két íróeszköz, és azok is ritkán, kötegelten írnak.

# Mérlegelt opciók

| Opció | Mellette | Ellene |
|---|---|---|
| **SQLite** | Nincs külön szolgáltatás. Egy fájl. A mentés `cp`. A tranzakció ingyen. `better-sqlite3` szinkron API-ja egyszálas Node-on a legegyszerűbb helyes megoldás. | Egy író egyszerre. Nem skálázódik több szerverre. |
| **Postgres** | Konkurens írás, replikáció, migrációs ökoszisztéma. | Második Coolify-service, második volume, connection pool, jelszókezelés, mentés `pg_dump`-pal. Évi 1 MB adatért. |
| **Fájlba írt JSON** | Még egyszerűbb. | Nincs tranzakció. Egy félbeszakadt írás az egészet elviszi. Az LWW-frissítés teljes újraírást igényelne. |

# Döntés

**SQLite**, `/data/marci.db` útvonalon, Coolify-volume-ra mountolva, `better-sqlite3` driverrel,
WAL journal módban.

# Miért

**A méret nem indokol adatbázis-szervert.** Évi 1 MB mellett a Postgres minden előnye elméleti
marad, minden költsége viszont azonnal jelentkezik: még egy konténer, ami elindulhat rosszul,
még egy jelszó, ami lejárhat, még egy mentési eljárás, amit karban kell tartani.

**Az egy-író korlát itt nem korlát.** A szerver egyetlen Node-folyamat; minden írás rajta megy át,
sorosan. A `POST /api/changes` amúgy is egyetlen tranzakcióba van zárva (az LWW-alkalmazás és a
`seq`-osztás atomi kell legyen). Nincs az a forgatókönyv, amiben két konkurens író fellépne.

**A mentés egyszerűsége önálló érv.** Egy családi projektnél a legvalószínűbb adatvesztési ok nem
az adatbázis-hiba, hanem az, hogy *soha nem készült mentés, mert bonyolult volt*. Egy
`sqlite3 marci.db ".backup"` parancs, amit egy cron elindít, olyan alacsony belépési küszöb, amit
tényleg be is állít az ember. Lásd
[mentés és visszaállítás](/runbooks/mentes-visszaallitas.md).

**A `better-sqlite3` szinkron API-ja előny, nem hátrány.** Node-ban általában kerülendő a
blokkoló I/O, de itt a műveletek mikroszekundumosak, és cserébe a tranzakciókezelés
`async`/`await`-mentes, tehát nem lehet elrontani egy elfelejtett `await`-tel.

# Következmények

- **A volume nélkül minden adat elvész.** Ha a Coolify-ban nincs perzisztens storage a `/data`
  útvonalra kötve, az adatbázis a konténer írható rétegében landol, és **minden redeploy törli**.
  Ez a projekt legvalószínűbb katasztrófaforgatókönyve. Lásd
  [Coolify + Hetzner](/integrations/coolify-hetzner.md).
- **WAL mód kell** (`PRAGMA journal_mode = WAL`), különben az olvasás blokkolja az írást. Ezzel
  együtt a `marci.db-wal` és `marci.db-shm` fájlok is megjelennek — a **mentésnek mindhármat
  konzisztensen kell kezelnie**, ezért kötelező a `.backup` parancs vagy az online backup API a
  puszta `cp` helyett.
- **Migráció kézi.** Nincs ORM és nincs migrációs keretrendszer. Egy `schema.sql` és egy
  `PRAGMA user_version`-alapú, sorszámozott migrációs lépcső elég ekkora projektre — de a
  lépcsőt a legelső verziótól vezetni kell, mert utólag felvenni fájdalmas.
- **Ha valaha kell webes admin vagy több párhuzamos kliens**, ez a döntés újranyitandó. A
  határ nem a méret, hanem a konkurens írók száma.
