---
okf_version: "0.2"
---

# Marci időmérő — projekt-wiki

Egy kétfelhasználós PWA Marci napi időtöltéseinek rögzítésére: mikor kezdődött és ért véget a
vacsora, a fürdés, az altatás, mikor aludt el, mikor ébredt. Két iPhone-ra telepítve,
kezdőképernyőre kitett webappként, saját Hetzner-szerveren.

> **2026-07-27: az app él a [marci.kozossegek.com](https://marci.kozossegek.com) címen.**
> `web/` (React 19 PWA) + `server/` (Hono + `node:sqlite`) + `Dockerfile`, Coolify-on.
> 19 teszt zöld, a deploy lefutott, és a perzisztens volume egy teljes újraépítést is túlélt.
> A telepítés menete: [Telepítés iPhone-ra](workflows/telepites-iphone-ra.md).

# Kezdd itt

* [CLAUDE.md](CLAUDE.md) - a séma: mikor és hogyan kell a wikit karbantartani. Minden munkamenet ezt olvassa el először.
* [architecture.md](architecture.md) - a rendszer felépítése, adatmodell, szinkron-protokoll, egy végigvezetett példa
* [glossary.md](glossary.md) - a projekt szótára: marker, szegmens, logikai nap, LWW, seq
* [faq.md](faq.md) - kérdések, amik felmerültek és érdemes megjegyezni
* [log.md](log.md) - a wiki változásnaplója, legújabb felül

# Döntések

Miért így épül, és nem másképp. A *Miért* szakasz a teherhordó.

* [PWA natív iOS app helyett](decisions/2026-07-27-pwa-nativ-ios-helyett.md) - nincs Xcode, nincs 99 dolláros fejlesztői fiók, nem jár le 7 naponta
* [Határjelölő adatmodell intervallumok helyett](decisions/2026-07-27-hatarjelolo-adatmodell.md) - a húzogatás egyetlen mezőt módosít, az átfedésmentesség konstrukcióból következik
* [Online-only, a szerver az egyetlen igazságforrás](decisions/2026-07-27-online-only.md) - nincs kliensoldali tár és nincs ütközésfeloldás; ez váltotta fel az eredeti offline-first tervet
* [Nincs hitelesítés](decisions/2026-07-27-nincs-hitelesites.md) - a felhasználó tudatos döntése; a kockázat és a visszaút rögzítve
* [SQLite adattár](decisions/2026-07-27-sqlite-adattar.md) - egy fájl, egy volume, triviális mentés
* [Egy konténer, egy domain](decisions/2026-07-27-egy-konteneres-deploy.md) - a statikus frontendet is az API szolgálja ki, így nincs CORS és nincs második service
* [Logikai napkezdet 04:00-kor](decisions/2026-07-27-logikai-napkezdet.md) - az alvás átnyúlik éjfélen, a naptári nap rossz vágás

# Funkciók

* [Gyorsrögzítés](features/gyorsrogzites.md) - a főképernyő: egy koppintás = „most kezdődött X", élő stopperrel
* [Napi idővonal](features/napi-idovonal.md) - a nap egyetlen sávon, húzható határokkal, utólagos javításhoz
* [Többnapos áttekintés](features/tobbnapos-attekintes.md) - napok egymás alatt, színkódolva; a minta itt válik láthatóvá
* [Tevékenységtípusok és színek](features/tevekenysegtipusok.md) - a paletta, a `__none__` pszeudotípus, és miért szerkeszthető
* [Adatfrissítés és többeszközös használat](features/szinkronizacio.md) - mikor frissül az adat, és mi történik, ha elmegy a hálózat

# Integrációk

Külső rendszerek, amiktől függünk — a szerződés és a szívatások, nem a gyártói doksi.

* [iOS Safari PWA](integrations/ios-safari-pwa.md) - mit tud és mit nem a kezdőképernyős webapp; a lista, ami eldönti, mi építhető
* [Coolify + Hetzner](integrations/coolify-hetzner.md) - a konkrét szerver, a deploy-szerződés, a volume, és a HTTP-figyelmeztetés

# Munkafolyamatok

* [Fejlesztői környezet](workflows/fejlesztoi-kornyezet.md) - repo, futtatás, portok
* [Deploy](workflows/deploy.md) - git push → Coolify build → élesedés
* [Telepítés iPhone-ra](workflows/telepites-iphone-ra.md) - a kezdőképernyőre tétel lépésről lépésre, mindkét telefonra

# Runbookok

Mit csinálj, ha elromlik.

* [Mentés és visszaállítás](runbooks/mentes-visszaallitas.md) - az SQLite fájl mentése, és a legrosszabb forgatókönyv
* [Szinkronhiba-elhárítás](runbooks/szinkron-hibaelharitas.md) - ha a két telefon nem ugyanazt mutatja

# Egyéb kategóriák

Jelenleg üresek, de a séma számít rájuk:

* [apps/](apps/index.md) - futásidejű felületek
* [scripts/](scripts/index.md) - scriptek, CLI-k
* [bugs/](bugs/index.md) - hibaboncolások
* [tech-debt/](tech-debt/index.md) - vállalt adósság
* [hacks/](hacks/index.md) - ideiglenes megkerülések
* [assets/](assets/index.md) - nyers emberi anyag (forrás, nem wiki-oldal)
