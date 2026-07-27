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
Egyelőre nem — `http://157.180.21.144:8000` marad. Következmény: **minden API-token cleartextben
utazik** a publikus interneten. 2026-07-27-én kiadásra került egy token az app beállításához;
**ezt használat után vissza kell vonni** (Keys & Tokens → API Tokens → a sor törlése), és
amíg a Coolify HTTP-n van, csak eseti, rövid életű tokent szabad kiadni. A rendszeres deployhoz
nincs is rá szükség: a GitHub-webhook elég.

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
Semmi különös: mindkét kérés a szerverre megy, és ott hajtódik végre. Ugyanannak a markernek az
egyidejű módosításánál az nyer, amelyik később ér be. Nincs figyelmeztetés arról, hogy a másik
telefon közben módosított — két embernél ez elfogadható.

**Mennyi idő alatt látja meg a másik telefon a rögzítést?**
Legfeljebb 30 másodperc, ha az app nyitva van; azonnal, ha közben előtérbe kerül.
[Részletek](/features/szinkronizacio.md).

# Technika

**Miért nincs offline mód?**
Volt — az [offline-first döntés](/decisions/2026-07-27-offline-first-lww-szinkron.md) implementálva
lett IndexedDB-vel, `dirty` jelöléssel és LWW ütközésfeloldással. Aztán kiderült, hogy a kiinduló
feltevés nem áll: mindig van hálózat. Az egész gépezet indoklás nélkül maradt, ezért kikerült.
[Az utód döntés](/decisions/2026-07-27-online-only.md) leírja, mit nyertünk és mit adtunk fel.

**Mi történik, ha mégis elmegy a hálózat?**
A mentés **nem történik meg**, és ezt hibasáv jelzi — újra kell nyomni. A korábban betöltött adat
a képernyőn marad, hogy ne üres felületet láss. Ez tudatosan vállalt ár.

**Miért a beépített `node:sqlite`, és nem a `better-sqlite3`?**
Mert így **nincs natív függőség**: az alpine Docker-image elég, és nincs fordítási lépés a
buildben. Az [SQLite-döntés](/decisions/2026-07-27-sqlite-adattar.md) indoklása (egy fájl, egy
volume, triviális mentés) változatlanul áll.

**Elveszhet-e adat?**
Az online-only modell óta gyakorlatilag egy forgatókönyv maradt, és az a súlyos:
**nincs Coolify-volume a `/data`-n** → minden redeploy törli az adatbázist. Ez a legvalószínűbb és
a legalattomosabb hiba, mert semmi nem jelzi. [Ellenőrzés](/integrations/coolify-hetzner.md).
A kliensen nincs mit elveszíteni: ami a szerverre felment, az megvan; ami nem ment fel, arról
hibaüzenetet kaptál.

**Miért nem külön frontend- és backend-service?**
Mert az azonos origin megszünteti a CORS-t, és mert így a frontend és a backend verziója **nem tud
elcsúszni** — ami egy agresszíven cache-elő service worker mellett valós veszély.
[Indoklás](/decisions/2026-07-27-egy-konteneres-deploy.md).

# Wiki

**Mi maradt `status: draft`?**
A [deploy](/workflows/deploy.md), a [telepítés iPhone-ra](/workflows/telepites-iphone-ra.md) és a
[runbookok](/runbooks/index.md) — ezek élesben még nem futottak le. A kód és a feature-oldalak
`stable`, mert a megvalósítás megvan és lokálisan ellenőrzött.

**Miért `index.md` és nem `_index.md`?**
Mert az OKF v0.2 az `index.md` és `log.md` neveket fenntartottnak deklarálja, a seed prompt viszont
aláhúzás-prefixet használt. Az OKF nyert, mert a konformancia gépi fogyaszthatóságot ad. A
[séma](/CLAUDE.md) mindhárom ilyen harmonizációt felsorolja.
