---
type: Schema
title: Wiki-séma — Marci időmérő
description: Mikor és hogyan kell karbantartani ezt a wikit; kategóriák, oldalformátumok, konvenciók.
tags: [meta, schema]
status: stable
generated: { by: "anthropic/claude-opus-5", at: "2026-07-27T18:05:00Z" }
sources:
  - id: karpathy-llm-wiki
    resource: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
    title: LLM Wiki — a minta leírása
    author: human:karpathy
  - id: okf-spec
    resource: https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md
    title: Open Knowledge Format (OKF) v0.2
  - id: seed-prompt
    resource: https://github.com/kondfox/ai-utils/blob/main/seeds/llm-wiki-seed-prompt.md
    title: Seed prompt — projekt-specifikus LLM Wiki bootstrap
---

# Mi ez

Ez a fájl a **séma**: az egyetlen igazságforrás arról, hogy mikor kell a wikit frissíteni, hogyan
kell oldalt írni, milyen kategóriák léteznek, és milyen formai konvenciók érvényesek. Minden jövőbeli
munkamenet ezt olvassa el először.

A wiki [Andrej Karpathy LLM Wiki mintáját][^karpathy-llm-wiki] követi, [OKF v0.2][^okf-spec]-konform
frontmatterrel, a [seed prompt][^seed-prompt] taxonómiája szerint.

[^karpathy-llm-wiki]: LLM Wiki — a minta leírása
[^okf-spec]: Open Knowledge Format (OKF) v0.2
[^seed-prompt]: Seed prompt — projekt-specifikus LLM Wiki bootstrap

# A három réteg

**1. Források (csak olvasható).** Ezekből olvasol, karbantartás közben soha nem írsz beléjük:

| Forrás | Hol | Megjegyzés |
|---|---|---|
| A kódbázis | `web/`, `server/`, `Dockerfile` a repo gyökerében | *Még nem létezik* — lásd az állapot-figyelmeztetést lent |
| Verziótörténet | `git log`, `git show`, `git blame` | A repóban jelenleg **nincs commit** |
| Hosztolt PR-ek/issue-k | github.com/frkandris/marci-app | A `gh` CLI **nincs telepítve** ezen a gépen; ha kell, `brew install gh` |
| Korábbi munkamenetek | `~/.claude/projects/-Users-p-tothandras-Code-marci-idomero-app/` | Jelenleg egyetlen transcript, a bootstrap-session |
| Nyers emberi anyag | [`assets/`](/assets/index.md) | Jegyzetek, képernyőképek, beszélgetés-kivonatok |

**2. A wiki (írható, derivált artefakt).** Ez a mappa. Kereszthivatkozott markdown oldalak, amiket
te hozol létre, szerkesztesz és törölsz. A wiki a forrásokból származik, nem fordítva.

**3. A séma.** Ez a fájl.

# ⚠️ A wiki jelenlegi állapota: TERV, nem valóság

**2026-07-27-én a projektnek nincs kódja.** A repo üres. Az [architektúra](/architecture.md), a
[features/](/features/index.md) és nagyrészt a [workflows/](/workflows/index.md) oldalak **szándékot**
írnak le, nem implementációt.

Ezek az oldalak `status: draft` frontmattert viselnek, és a törzsük tetején ott a
`> **Állapot: tervezett.**` sor.

**Amikor egy terv kóddá válik**, a következő a dolgod ugyanabban a commitban:

1. `status: draft` → `status: stable`
2. A `> **Állapot: tervezett.**` bannert töröld
3. Tegyél be `file:line` hivatkozásokat a valódi belépési pontokra
4. Javítsd, ahol a megvalósítás eltért a tervtől — **ne írd felül némán**, hanem a
   [döntés-oldalon](/decisions/index.md) rögzítsd, hogy miért tért el
5. Egysoros bejegyzés a [`log.md`](/log.md)-be

A [döntés-oldalak](/decisions/index.md) ezzel szemben **valódiak** és `status: stable` — azok a
döntések ténylegesen megszülettek, akkor is, ha a kód még nem áll mögöttük.

# Mikor kell frissíteni a wikit

Ezt a listát minden munkamenet kezelje ellenőrzőlistaként az aktuális feladatra:

- **Új app / futásidejű felület** → [`apps/`](/apps/index.md) (ritka)
- **Nem triviális feature megvalósult vagy módosult** → [`features/`](/features/index.md),
  belépési pontokra mutató `file:line` hivatkozásokkal
- **Architekturális vagy tervezési döntés született** →
  [`decisions/YYYY-MM-DD-<slug>.md`](/decisions/index.md). A **miért** a lényeg. Hagyd ki, ha a miért
  nyilvánvaló a diffből.
- **Workaround/hack került be** → [`hacks/`](/hacks/index.md). Hosszabb életű, tudatosan vállalt
  adósság → [`tech-debt/`](/tech-debt/index.md).
- **Nem triviális bug javult** → [`bugs/YYYY-MM-DD-<slug>.md`](/bugs/index.md). **Csak akkor**, ha a
  gyökérok meglepő volt, vagy a hibaosztály várhatóan visszatér. Triviális javítást, amit a diff
  megmagyaráz, ne írj le.
- **Külső integráció változott** → [`integrations/`](/integrations/index.md)
- **Script/parancs/munkafolyamat került be, átnevezve vagy megszűnt** →
  [`scripts/`](/scripts/index.md) vagy [`workflows/`](/workflows/index.md)
- **Nem magától értetődő kérdés merült fel** → [`faq.md`](/faq.md).
  **Szakkifejezés merült fel** → [`glossary.md`](/glossary.md)
- **Incidens megoldva, vagy visszatérő hiba azonosítva** → [`runbooks/`](/runbooks/index.md)
- **Fájl került az [`assets/`](/assets/index.md)-be** → dolgozd be a megfelelő oldalakba
- **Mindig**: egysoros bejegyzés a [`log.md`](/log.md)-be

# Mikor NE frissítsd

- Triviális változás: átnevezés, formázás, lint, dependency-bump
- Bármi, ami már benne van a repo gyökér `CLAUDE.md`-jében — **linkelj, ne duplikálj**
- Bármi, ami triviálisan kiolvasható a kódból
- Spekulatív jövőbeli tervek. A wiki azt írja le, ami **van**. (A jelenlegi `draft` oldalak
  kivételek, amiket a felhasználó kifejezetten kért — de új spekulációt ne adj hozzájuk.)
- Területek, amiket az aktuális feladat nem érintett

Kétség esetén **linkelj a forrásra** (`file:line`, commit SHA, PR-szám) másolás helyett.

# Hogyan írj oldalt

- **Egy fogalom = egy oldal.** ~200 sor felett bontsd szét.
- **A válasszal kezdj**, utána jöjjön a provenance. Ne vezess fel.
- **Hivatkozz bőven** más oldalakra.
- **Provenance kötelező** minden nem magától értetődő állításnál: fájlútvonal sorszámmal (ha stabil),
  commit SHA, PR-szám, vagy `sources` bejegyzés.
- **Ellentmondást jelezz, ne írd felül némán.** Tartsd meg az igazabb változatot, és írd meg a
  [`log.md`](/log.md)-ben, hogy mit cseréltél és miért.
- **Dátum mindig abszolút**, `YYYY-MM-DD`. Soha nem „nemrég", „a múlt héten".
- **Nyelv: magyar.** A szakkifejezések, azonosítók, parancsok, mezőnevek maradnak eredeti alakban
  (`service worker`, `IndexedDB`, `editedAt`). Ne magyarítsd az azonosítókat.

## Frontmatter (OKF v0.2)

Minden `.md` fájl a wikiben — kivéve a fenntartott `index.md` és `log.md` neveket — YAML
frontmatterrel kezdődik, amiben **kötelező** a `type` mező:

```yaml
---
type: Decision                # KÖTELEZŐ. Rövid string, a fogalom fajtája.
title: Emberi cím
description: Egymondatos összefoglaló.
tags: [tag1, tag2]
status: draft | stable | deprecated       # alapértelmezés, ha hiányzik: stable
generated: { by: "anthropic/claude-opus-5", at: "2026-07-27T18:00:00Z" }
verified: { by: "human:frkandris", at: "2026-07-28T09:00:00Z" }   # csak ha tényleg átnézte
stale_after: 2026-12-31       # abszolút dátum, amikortól elavultnak tekintendő
sources:
  - id: rovid-kulcs
    resource: https://... vagy /bundle/relativ/ut.md      # KÖTELEZŐ a sources-on belül
    title: Cím
    author: human:frkandris | anthropic/claude-opus-5 | process:ci
    last_modified: 2026-07-27
---
```

**Ebben a projektben használt `type` értékek:**

| `type` | Mire |
|---|---|
| `Schema` | Ez a fájl |
| `Architecture` | [`architecture.md`](/architecture.md) |
| `Decision` | [`decisions/`](/decisions/index.md) oldalak |
| `Feature` | [`features/`](/features/index.md) oldalak |
| `Integration` | [`integrations/`](/integrations/index.md) oldalak |
| `Workflow` | [`workflows/`](/workflows/index.md) oldalak |
| `Runbook` | [`runbooks/`](/runbooks/index.md) oldalak |
| `Bug Postmortem` | [`bugs/`](/bugs/index.md) oldalak |
| `Tech Debt` | [`tech-debt/`](/tech-debt/index.md) oldalak |
| `Hack` | [`hacks/`](/hacks/index.md) oldalak |
| `Glossary` | [`glossary.md`](/glossary.md) |
| `FAQ` | [`faq.md`](/faq.md) |
| `Source` | [`assets/`](/assets/index.md) nyers anyagok |

**Aktor-konvenció (OKF §7):** `<gyártó>/<verzió>` ágensekre, `human:<id>` emberekre,
`process:<id>` automatizmusokra. A `human:` prefix teszi megkülönböztethetővé az emberi
jóváhagyást — **kötelező** emberi szerzőség/ellenőrzés jelölésénél.

**Bizalmi szintek (OKF §5.3)**, a `verified` mezőből származtatva:

- nincs `verified` → **unverified** ← jelenleg a wiki minden oldala ilyen
- csak gépi aktor → **machine-confirmed**
- van `human:` aktor → **human-reviewed**

## Három harmonizáció a források között

A három forrás konvenciói néhány ponton ütköznek. Ez a wiki így oldja fel:

1. **`_index.md` / `_log.md` → `index.md` / `log.md`.** A seed prompt aláhúzás-prefixet használ,
   de az OKF §3.1 az `index.md` és `log.md` neveket **fenntartottnak** deklarálja. Az OKF nyer,
   mert a konformancia gépi fogyaszthatóságot ad. Következmény: ezek a fájlok nem viselnek
   frontmattert (kivétel: a bundle-gyökér `index.md` hordozhatja az `okf_version`-t, OKF §8).

2. **`[[obsidian-link]]` → `[cím](/ut.md)`.** A seed és Karpathy Obsidian-stílusú linkeket javasol,
   az OKF §6 sima markdown linkeket ír elő. A markdown link **mindkettőt kiszolgálja**: az Obsidian
   is feloldja és berajzolja a gráfnézetbe, az OKF-fogyasztó pedig parse-olni tudja. Ezért mindenhol
   bundle-relatív markdown link megy, `/`-rel kezdve.

3. **`assets/` frontmatter.** A seed szerint az `assets/` nyers forrásanyag, nem wiki-oldal. Az OKF
   §11 viszont minden nem fenntartott `.md`-től megköveteli a `type` mezőt. Feloldás: az
   `assets/`-beli markdown fájlok minimális `type: Source` frontmattert kapnak. Tartalmilag
   továbbra is **csak olvashatók** — karbantartás közben nem írjuk át őket.

## Oldalvázak

**`decisions/YYYY-MM-DD-<slug>.md`** — a *Miért* a teherhordó szakasz:

```markdown
# Kontextus
Mi volt a helyzet, ami döntést igényelt.

# Mérlegelt opciók
| Opció | Mellette | Ellene |

# Döntés
Egy mondat, kijelentő módban.

# Miért
Ez a lényeg. Miért ez nyert, és miért nem a többi. Konkrét kényszerek, számok, korlátok.

# Következmények
Mit zár ki, mit tesz nehezebbé, mit kell újragondolni, ha X változik.
```

**`bugs/YYYY-MM-DD-<slug>.md`** — a *Gyökérok* a teherhordó szakasz:

```markdown
# Tünet
Mit látott a felhasználó. Konkrétan.

# Gyökérok
Miért történt. Nem a tünet átfogalmazása.

# Javítás
Mi változott, commit SHA-val.

# Tanulság
Mi általánosítható. Milyen osztályú hiba ez.
```

**`log.md`** — append-only, **legújabb felül**, **egy önmagában értelmes sor bejegyzésenként**.
Az egysorosság nem stílus, hanem követelmény: ez teszi a `union` merge drivert működőképessé, és
így grep-elhető a fájl.

```markdown
## 2026-07-27
* **Létrehozás**: [Döntés — PWA natív iOS helyett](/decisions/2026-07-27-pwa-nativ-ios-helyett.md) rögzítve.
```

# A séma fejlesztése

A taxonómia kiindulópont, nem kőbe vésett. Ha egy tartalom valóban egyik meglévő kategóriába sem
fér: hozd létre a mappát + `index.md`-t, vedd fel ebbe a fájlba a fába, adj hozzá „Mikor kell
frissíteni" triggert, linkeld az [`index.md`](/index.md)-ből, és logold.

**Alapértelmezésben NE adj hozzá kategóriát**, ha egy meglévő elnyeli a tartalmat. A séma
fejlődése legyen explicit és ritka.

# Eszköz-határok

- A wiki **ki van zárva a formázóból** — `.prettierignore` a repo gyökerében. A projektben (még)
  nincs Prettier, de az ignore fájl előre ott van, hogy a bevezetése ne írja át a próza tördelését.
- A wiki **nincs benne** semmilyen TypeScript/build projektben. Amikor a `web/` és `server/`
  létrejön, a `tsconfig.json` `include`-ja **ne** érje el a `wiki/`-t.
- A wiki **git-be van commitolva**.
- **A wiki-frissítés ugyanabba a commitba kerül, mint a kódváltozás, ami kiváltotta.** Ez a
  minta teherhordó szabálya — így a `git log` összeköti a kettőt.
- A [`log.md`](/log.md) `union` merge drivert kap a `.gitattributes`-ban, mert két telefonról /
  két ágról párhuzamosan bővülhet. Ezért kötelező az egysoros bejegyzés.
