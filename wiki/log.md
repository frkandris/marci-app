# A wiki változásnaplója

Append-only, legújabb felül. **Egy önmagában értelmes sor bejegyzésenként** — ez teszi a `union`
merge drivert működőképessé és a fájlt grep-elhetővé:

    grep "^\* " wiki/log.md | head -20

## 2026-07-27

* **Megfordított döntés**: A gyorsrögzítő gombok **használat szerint** rendeződnek (gyakoriság + frissesség egyetlen, 7 napos felezésű pontszámban), azonnali újraszámolással. A korábbi „fix sorrend az izommemóriáért" indoklást a felhasználó felülbírálta. A Beállítások fülön kikapcsolható.
* **Létrehozás**: A napi sáv üres részére koppintva új esemény hozható létre az adott időpontban, mint a naptáralkalmazásokban.
* **Hibajavítás**: A csippentés azért akadozott, mert minden gesztus-frame teljes React-újrarenderelést váltott ki (~45 pozicionált elem). A skála mostantól CSS-változó (`--pxh`), a gesztus alatt egyetlen stílusírás történik, az állapot csak a végén szinkronizálódik.

* **Változás**: A napi idővonalon a „Törlés" mostantól **nem rögzítetté** teszi a szegmenst (`__none__`), nem eldobja a markert. A marker eldobása az ELŐZŐ tevékenységnek tulajdonította volna a sávot — a felhasználó ezt joggal érezte hibának.
* **Létrehozás**: A szegmens **kezdete és vége** közvetlenül szerkeszthető a lapon. A vég a rákövetkező marker kezdete, ezért azt mozgatja; futó szegmensnél nem szerkeszthető.
* **Létrehozás**: Napi összesítő a Nap nézet fejlécében, tevékenységenként, hossz szerint rendezve.
* **Létrehozás**: „Mégsem ez volt — vissza: X" a futó tevékenység kártyáján, 10 perces ablakban; a Toggl „Discard idle and continue" mintája alapján.
* **Csere**: A kézzel írt csippentés-kezelő helyett `@use-gesture/react`. A `react-zoom-pan-pinch` azért nem jó ide, mert a tartalmat vizuálisan transzformálja — a feliratok is nyúlnának.

* **Döntés**: [Konsta UI a vázhoz](decisions/2026-07-27-konsta-ui.md) — Tailwind v4 + iOS téma; a napsáv, idővonal és gombrács saját CSS-ben marad, mert ezekre nincs komponens.
* **Buktató**: A Konsta a `.dark` OSZTÁLYRA szűr, nem `prefers-color-scheme`-re — a `main.tsx` kézzel tartja szinkronban.
* **Buktató**: A Konsta `ListInput` **fehér képernyővel elszáll** (5.2.0): `title: null`-t ad tovább, a `cls()` pedig elhasal `null` argumentumon. Saját input maradt.
* **Hibajavítás**: Codex review 7 találata javítva — köztük a healthcheck 401-je bekapcsolt `SHARED_TOKEN` mellett, és a `dayKey` nyári időszámítás-hibája (mérve: 4 rossz napbesorolás). Új invariáns-teszt őrzi.
* **Létrehozás**: Teljes kategóriakezelés — létrehozás, szerkesztés, drag-and-drop sorrendezés, archiválás és végleges törlés használat-ellenőrzéssel.
* **Létrehozás**: Saját 16 elemű flat SVG ikonkészlet emoji helyett (v3 migrációval), `wiki/bugs/` postmortem a `confirm()`-fagyásról.
* **Deploy**: Az app **él** a `https://marci.kozossegek.com` címen. Coolify-projekt `marci` (`mmhmv2jt5v06a3uochio570d`), alkalmazás `yo75ku697v37lvjaotkrmwra`, volume `yo75ku697v37lvjaotkrmwra-marci-data` → `/data`.
* **Ellenőrzés**: A perzisztens volume **túlélt egy teljes force-újraépítést** — sentinel markerrel mérve. Ez a projekt legveszélyesebb hibalehetősége, és bizonyítottan nem áll fenn.
* **Hibajavítás**: Az első deploy elhasalt, mert a Coolify a `NODE_ENV=production`-t **build időben is** beinjektálta, amitől az `npm ci` kihagyta a devDependencies-t (nincs vite, nincs typescript). A Dockerfile build fázisa mostantól explicit `NODE_ENV=development`-et állít és `--include=dev`-vel telepít. Részletek: [deploy](workflows/deploy.md).
* **Létrehozás**: Az app megvalósult — `web/` (React 19 + Vite PWA), `server/` (Hono + `node:sqlite`), `Dockerfile`; 19 teszt zöld, a felület böngészőben ellenőrizve.
* **Döntés**: [Online-only](decisions/2026-07-27-online-only.md) — a felhasználó visszavonta az offline-igényt („mindig nethez vagyunk kapcsolódva"), így kiesett az IndexedDB, a `dirty` jelölés, az LWW, a `seq` kurzor és a soft delete; a marker három időbélyege egyre csökkent.
* **Felülírás**: [Offline-first, LWW-szinkronnal](decisions/2026-07-27-offline-first-lww-szinkron.md) `status: deprecated`, utódra mutató bannerrel; a tartalom történeti értékként megmarad.
* **Eltérés a tervtől**: `better-sqlite3` helyett a beépített `node:sqlite` — nincs natív függőség, ezért az alpine image elég és nincs fordítási lépés a Dockerben. Az [SQLite-döntés](decisions/2026-07-27-sqlite-adattar.md) indoklása változatlanul áll.
* **Hibajavítás**: A `serveStatic` `root`-ja a cwd-hez képest oldódott fel, ezért **egyetlen statikus fájlt sem szolgált ki** — minden asset a HTML-fallbackre esett. Kézi, abszolút útvonalas kiszolgálásra cserélve; a füstteszt fogta meg deploy előtt.
* **Hibajavítás**: Az ismeretlen `/api/*` útvonal `index.html`-t adott 200-zal az SPA-fallbackről; most JSON 404. Pontosan az a hibakép, amire az [egy konténeres deploy](decisions/2026-07-27-egy-konteneres-deploy.md) döntés figyelmeztetett.
* **Hibajavítás**: A `runningMarker` jövőbeli markert is „futónak" vett — egy elgépelt visszamenőleges rögzítés 0:00-s stoppert és hamis aktuális tevékenységet adott. Regressziós teszttel lefedve.
* **Állapotváltás**: A wiki **minden oldala `stable`** — a deploy élesben lefutott, így a maradék `draft` oldalak is lezárultak.
* **Megoldva**: A projekt egyetlen blokkoló kérdése lezárult — az app domainje **`marci.kozossegek.com`**, a DNS él, és a Cloudflare-proxyn át eljut a Coolify Traefikjéig (404, mert még nincs alkalmazás konfigurálva); a PWA HTTPS-követelménye ezzel teljesül.
* **Megjegyzés**: A domain **Cloudflare-proxyn** megy, nem közvetlenül a Hetznerre — a Cloudflare SSL/TLS módja legyen „Full (strict)", különben átirányítási hurok. Új nyitott kérdés a [faq.md](faq.md)-ben.
* **Megjegyzés**: A Coolify **saját felülete** továbbra is HTTP-n van; ezért API-tokent nem adunk ki, a deployhoz a GitHub-webhook elég.
* **Ellenőrzés**: 37 fájl, 243 belső link és minden horgony feloldódik; 0 árva oldal; minden nem fenntartott fájl parse-olható YAML frontmattert és nem üres `type` mezőt tartalmaz (OKF §11 konformancia teljesül).
* **Javítás**: A `generated`/`verified` YAML flow-mappingekben az időbélyegek és a `human:` prefixű aktorok idézőjelet kaptak — idézőjel nélkül a `:` miatt egyik frontmatter sem volt parse-olható, ami OKF §11 sértés volt.
* **Létrehozás**: Wiki bootstrap — [séma](CLAUDE.md), [index](index.md), taxonómia és a kezdő oldalkészlet létrehozva a Karpathy LLM Wiki minta + OKF v0.2 frontmatter + kondfox seed prompt alapján.
* **Létrehozás**: [architecture.md](architecture.md) — tervezett rendszerfelépítés, SQLite-séma, `/api/changes` szinkronprotokoll és egy végigvezetett példa; `status: draft`, mert kód még nincs.
* **Döntés**: [PWA natív iOS app helyett](decisions/2026-07-27-pwa-nativ-ios-helyett.md) — a gépen nincs Xcode, és az ingyenes sideload 7 naponta lejár.
* **Döntés**: [Határjelölő adatmodell](decisions/2026-07-27-hatarjelolo-adatmodell.md) — a nap határjelölők sorozata, nem intervallumoké; a húzogatás így egyetlen mező írása.
* **Döntés**: [Offline-first, LWW-szinkronnal](decisions/2026-07-27-offline-first-lww-szinkron.md) — kliens `edited_at` dönt az ütközésről, szerver `seq` a szinkronkurzor.
* **Döntés**: [Nincs hitelesítés](decisions/2026-07-27-nincs-hitelesites.md) — a felhasználó tudatosan választotta a nyílt backendet; a kockázat és a `SHARED_TOKEN` visszaút rögzítve.
* **Döntés**: [SQLite adattár](decisions/2026-07-27-sqlite-adattar.md) — egyetlen fájl a Coolify volume-on, `cp`-vel menthető.
* **Döntés**: [Egy konténeres deploy](decisions/2026-07-27-egy-konteneres-deploy.md) — a Hono szolgálja ki a statikus buildet is, így nincs CORS és nincs második Coolify-service.
* **Döntés**: [Logikai napkezdet 04:00](decisions/2026-07-27-logikai-napkezdet.md) — az éjszakai alvás egyben marad a napi soron.
* **Létrehozás**: [integrations/ios-safari-pwa.md](integrations/ios-safari-pwa.md) — az iOS PWA képesség- és korláttáblája, ami a feature-tervek kereteit adja (nincs Background Sync, `100vh` csapda, ITP és a kezdőképernyős kivétel).
* **Létrehozás**: [integrations/coolify-hetzner.md](integrations/coolify-hetzner.md) — a konkrét példány `http://157.180.21.144:8000`, Coolify v4.1.2, böngészőből ellenőrizve; az API-token útvonala `Keys & Tokens → API Tokens` (`/security/api-tokens`).
* **Megjegyzés**: A Coolify jelenleg **titkosítatlan HTTP-n** érhető el publikus IP-n — az API-token cleartextben utazna. Nyitott kérdés, lásd [faq.md](faq.md).
