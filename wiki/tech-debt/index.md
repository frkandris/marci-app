# Vállalt adósság

Egy oldal tételenként. Ide a **hosszabb életű, tudatosan vállalt** adósság kerül — az, amiről
tudjuk, hogy nem jó, de most így marad, és tudjuk, mi lenne a helyes.

A rövid életű, „amint lesz időm kiveszem" jellegű megkerülések a [hacks/](/hacks/index.md)-be
mennek. A különbség a szándékban van: az adósság **vállalt**, a hack **ideiglenes**.

Minden tételnél legyen ott: mi az adósság, **miért vállaltuk**, mi a helyes megoldás, és **mi
váltaná ki a törlesztést**.

## Nyitott

Egyelőre nincs — a projektnek még nincs kódja.

## Már most ismert, a kód megírása előtt

Ezek nem véletlenül keletkeznek majd, hanem tudatos döntésekből következnek. Amint a kód létezik,
**ide kerülnek rendes tételként**:

* **Nincs mezőnkénti merge a szinkronban.** Konkurens szerkesztésnél a későbbi `edited_at` a teljes rekordot felülírja. Vállalva, mert két családi telefonnál ritka. A helyes megoldás CRDT lenne. Kiváltó ok a törlesztésre: ha háromnál több eszköz vagy rendszeres konkurens szerkesztés lép fel. [Döntés](/decisions/2026-07-27-offline-first-lww-szinkron.md)
* **Nincs hitelesítés.** Vállalva a súrlódásmentességért. A `SHARED_TOKEN` visszaút a tervek szerint az első verzióban benne lesz, kikapcsolva. Kiváltó ok: ismeretlen IP-ről érkező `/api/*` kérések a logban. [Döntés](/decisions/2026-07-27-nincs-hitelesites.md)
* **Nincs staging, nincs CI-teszt, nincs blue-green deploy.** Vállalva, mert két felhasználónál a leállás ára néhány perc. [Deploy workflow](/workflows/deploy.md)
* **Kézi SQL-migráció, ORM nélkül.** `PRAGMA user_version` alapú lépcsővel. Ez ekkora projektre helyes, de a lépcsőt **a legelső verziótól** vezetni kell — utólag felvenni fájdalmas. [Döntés](/decisions/2026-07-27-sqlite-adattar.md)

## Törlesztett

Egyelőre nincs.
