---
type: FAQ
title: Gyakori kérdések
description: Kérdések, amik felmerültek, és a válasz nem magától értetődő a kódból.
tags: [reference]
status: stable
generated: { by: "anthropic/claude-opus-5", at: "2026-07-27T19:50:00Z" }
---

Ide olyan kérdés kerül, ami **ténylegesen felmerült**, és a válasza nem olvasható ki triviálisan a
kódból. Ha egy kérdés megérdemel egy egész oldalt, akkor oda kerüljön, és innen csak link menjen rá.

# Nyitott kérdések

**Milyen SSL/TLS módban van a Cloudflare?**
A `marci.kozossegek.com` **Cloudflare-proxyn keresztül** megy, nem közvetlenül a Hetznerre. Ha a
mód „Flexible", akkor a Cloudflare→origin szakasz titkosítatlan, és a Coolify HTTPS-átirányításával
átirányítási hurkot adhat. Ellenőrizendő, hogy **„Full (strict)"** legyen.
[Részletek](/integrations/coolify-hetzner.md).

**Kap-e a Coolify felülete is HTTPS-t?**
Egyelőre nem — `http://157.180.21.144:8000` marad. Ennek egyetlen gyakorlati következménye, hogy
**API-tokent nem szabad kiadni**, mert cleartextben utazna. A deployhoz nincs is rá szükség: a
GitHub-webhook elég.

**Maradjon-e a nyílt API?**
Egyelőre igen, ez [tudatos döntés](/decisions/2026-07-27-nincs-hitelesites.md). A `SHARED_TOKEN`
visszaút viszont **már az első verzióba** kerüljön bele, kikapcsolva — utólag bevezetni drágább,
mert a már telepített PWA-kat is frissíteni kell hozzá.

# Megválaszolt kérdések

**Lesz-e domain, és mikor?** — *Megválaszolva 2026-07-27-én.*
Igen: **`marci.kozossegek.com`**. A DNS él, a Cloudflare-en át eljut a Coolify Traefikjéig
(404-et ad, mert még nincs alkalmazás konfigurálva rá). A PWA HTTPS-követelménye ezzel teljesül,
tehát **az app telepíthető iPhone-ra**. Ez volt a projekt egyetlen blokkoló kérdése.

# Termék

**Miért nem lehet egyszerűen „vacsora 18:00–18:35"-öt beírni?**
Mert az [adatmodell nem intervallumokból áll](/decisions/2026-07-27-hatarjelolo-adatmodell.md),
hanem határjelölőkből. A UI szintjén ez nem látszik — a felhasználó szegmenseket lát —, de a
szerkesztés mindig határok mozgatása. Ennek az az ára, hogy „lyukat" csak a `__none__`
pszeudotípussal lehet kifejezni, és cserébe átfedés soha nem keletkezhet.

**Mi történik, ha elfelejtem lezárni az utolsó tevékenységet?**
A futásban marad, és a végtelenségig tart. A [gyorsrögzítés](/features/gyorsrogzites.md)
figyelmeztet, ha egy tevékenység 12 óránál régebben fut. Ha ez megtörtént, utólag az
[idővonalon](/features/napi-idovonal.md) tehető be egy „Vége" marker.

**Miért 04:00-kor kezdődik a nap?**
Hogy az éjszakai alvás egyben maradjon a napi soron. Éjfélkor vágva a leghosszabb és
legérdekesebb szegmens kettétörne, két külön sorra.
[Részletes indoklás](/decisions/2026-07-27-logikai-napkezdet.md).

**Mi történik, ha mindkét telefonon egyszerre rögzítünk?**
Ha **különböző** markereket, semmi — mindkettő felmegy, összefésülődik. Ha **ugyanazt** módosítjuk
offline, a későbbi `edited_at` nyer, és a másik módosítás **elveszik** (nincs mezőnkénti merge).
Két családi telefonnál ezt elfogadtuk —
[indoklás](/decisions/2026-07-27-offline-first-lww-szinkron.md).

# Technika

**Miért kell `edited_at` ÉS `seq` is? Nem redundancia?**
Nem — két különböző problémát oldanak meg, és a felcserélésük némán adatot veszít. A `seq` azért
kurzor, mert szerveroldali és garantáltan monoton; egy kliensóra hátraállítása esetén az
`edited_at`-tel kurzorozva sorok **örökre láthatatlanná** válnának. Az `edited_at` viszont azért
dönt az ütközésről, mert az a helyes kérdés, hogy *mikor döntött úgy az ember* — nem az, hogy
melyik telefon jutott előbb hálózathoz.
[Kifejtve](/decisions/2026-07-27-offline-first-lww-szinkron.md).

**Miért nem CRDT?**
Mert azt a problémát oldja meg, ami itt nincs: sok szerkesztő, ugyanazon a mezőn, konkurensen,
veszteségmentes megőrzési igénnyel. Itt két ember van, akik szinte mindig különböző markereket
írnak. A CRDT ára — függőség, tárméret, hibakeresési nehézség — semmit nem vásárolna.

**Miért nem működik a szinkron, amíg az app be van zárva?**
Mert iOS-en **nincs Background Sync API**. A szinkron csak előtérben futhat: appindításkor,
`visibilitychange`-nél, `online`-nál, és írás után debounce-olva. Ez nem hiba, hanem
platformkorlát — [a teljes lista](/integrations/ios-safari-pwa.md).

**Elveszhet-e adat?**
Három reális forgatókönyv van, mindhárom dokumentált:
1. **Nincs Coolify-volume a `/data`-n** → minden redeploy törli az adatbázist. Ez a legvalószínűbb
   és a legalattomosabb, mert semmi nem jelzi. [Ellenőrzés](/integrations/coolify-hetzner.md).
2. **A kezdőképernyős ikon törlése** iOS-en törli a lokális tárat → a még fel nem szinkronizált
   változások elvesznek. Ezért mutat a UI jelzést a függőben lévő változásokról.
3. **Konkurens szerkesztés** ugyanazon a markeren → az egyik oldal módosítása felülíródik (LWW).

**Miért nem külön frontend- és backend-service?**
Mert az azonos origin megszünteti a CORS-t, és mert így a frontend és a backend verziója **nem tud
elcsúszni** — ami egy agresszíven cache-elő service worker mellett valós veszély.
[Indoklás](/decisions/2026-07-27-egy-konteneres-deploy.md).

# Wiki

**Miért `status: draft` a legtöbb oldal?**
Mert 2026-07-27-én a repóban **nincs kód**. Az architektúra- és feature-oldalak tervet írnak le,
nem implementációt. A [döntések](/decisions/index.md) viszont `stable`, mert azok tényleg
megszülettek. A séma leírja, mit kell frissíteni, amikor egy terv kóddá válik — lásd
[CLAUDE.md](/CLAUDE.md).

**Miért `index.md` és nem `_index.md`?**
Mert az OKF v0.2 az `index.md` és `log.md` neveket fenntartottnak deklarálja, a seed prompt viszont
aláhúzás-prefixet használt. Az OKF nyert, mert a konformancia gépi fogyaszthatóságot ad. A
[séma](/CLAUDE.md) mindhárom ilyen harmonizációt felsorolja.
