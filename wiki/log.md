# A wiki változásnaplója

Append-only, legújabb felül. **Egy önmagában értelmes sor bejegyzésenként** — ez teszi a `union`
merge drivert működőképessé és a fájlt grep-elhetővé:

    grep "^\* " wiki/log.md | head -20

## 2026-07-27

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
