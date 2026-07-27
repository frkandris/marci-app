---
type: Decision
title: Logikai napkezdet 04:00-kor, nem éjfélkor
description: A nap 04:00-kor vált, hogy az éjszakai alvás egyben maradjon a napi soron.
tags: [data-model, timeline, ux]
status: stable
generated: { by: "anthropic/claude-opus-5", at: "2026-07-27T18:55:00Z" }
---

# Kontextus

A felhasználó kérése: „lehetne naponta egymás alatt látni". Ehhez el kell dönteni, **hol vágjuk
ketté** az idő folyamát napokra.

A rögzített tevékenységek legfontosabbika — az alvás — jellemzően **19:30 és 06:30 között** tart,
tehát **átnyúlik éjfélen**.

# Mérlegelt opciók

| Opció | Mellette | Ellene |
|---|---|---|
| **Naptári nap (00:00)** | A legkézenfekvőbb. Egybeesik a dátummal, nincs magyarázandó fogalom. | Az éjszakai alvás **kettétörik**: a soron a nap végén és a nap elején is megjelenik egy-egy darabja. Pont a legfontosabb szegmens válik olvashatatlanná. |
| **Logikai nap 04:00-tól** | Az éjszakai alvás **egyben marad**, a rá következő nap sorának elején. A napi sorok mintája így válik leolvashatóvá. | Egy plusz fogalom. A „2026-07-27-i nap" nem azonos a 2026-07-27-i naptári nappal. |
| **Ébredéshez igazított, dinamikus vágás** | Elvben a legpontosabb. | A napok eltérő hosszúak lennének → **a sorok nem összehasonlíthatók vizuálisan**, ami a többnapos nézet egyetlen célja. |

# Döntés

A **logikai nap 04:00-kor kezdődik** helyi idő szerint, és a következő nap 04:00-ig tart. Egy
esemény ahhoz a logikai naphoz tartozik, amelyiknek az intervallumába az `at`-je esik.

A napkezdet **konfigurálható** (`meta` tábla, `day_start_hour`), de az alapérték 04:00.

# Miért

**A 04:00 a legkisebb aktivitású óra.** A vágásnak olyan időpontra kell esnie, ahol a legkisebb
eséllyel történik átmenet. Egy 19:30–06:30-as alvásritmus mellett a hajnali 4 óra mélyen az alvás
belsejében van — ott vágni azt jelenti, hogy a vágás **egy szegmensen belülre esik**, nem egy
határra, és a következő nap sora az alvás közepéről indul, ami vizuálisan folytonos marad.

**A dinamikus vágás azért bukik, mert a nézet célja az összehasonlítás.** A „napok egymás alatt"
nézet egyetlen dolgot ad, amit más nem: **függőlegesen leolvasható a minta** — hogy az alvás
csúszik-e, hogy a vacsora mindig ugyanakkor van-e. Ez csak akkor működik, ha minden sor **azonos
időtengelyt** használ. Változó hosszúságú napoknál a függőleges összeolvasás értelmét veszti, és
a nézet nem ér semmit.

**Az éjfél nem semleges, hanem a legrosszabb választás.** Éppen a legfontosabb, leghosszabb és
legérdekesebb szegmenst — az éjszakai alvást — vágja ketté, és két darabban, két külön soron
jeleníti meg. Az alvás hossza, ami a leggyakrabban feltett kérdés, két sor összeadásából jönne ki.

# Következmények

- **A napi lekérdezés nem `WHERE date(at) = ?`.** Mindig a `[nap 04:00, következő nap 04:00)`
  félig nyílt intervallumra megy, helyi időzóna szerint.
- **A napi nézet mindig hozza el a nap kezdete előtti utolsó markert is.** Ez a
  [határjelölő modellből](/decisions/2026-07-27-hatarjelolo-adatmodell.md) következik: a nap első
  szegmensét gyakran egy előző napi marker definiálja. Ha ez kimarad, a nap eleje üresnek látszik
  — **ez a rendszer legkönnyebben elrontható pontja.**
- **Az időzóna a kliensé, és nem UTC.** Az `at` epoch ms-ben tárolódik, de a napra bontás **helyi
  idő szerint** történik. Nyári időszámítás váltásakor egy logikai nap 23 vagy 25 órás lesz; a
  többnapos nézetnek ezt vagy kezelnie kell, vagy tudatosan figyelmen kívül hagynia — de nem
  szabad, hogy elcsússzon tőle a rács.
- **A napkezdet megváltoztatása visszamenőleg átrendezi a történelmet.** Ha valaki 04:00-ról
  06:00-ra állítja, események vándorolnak át a szomszédos napra. A beállítás mellett ezt jelezni
  kell, különben elrontott adatnak látszik.
- **A megnyitva hagyott app „mája" elavul.** A telefonon a PWA napokig fut egyben, és 04:00-kor a
  „ma" mást jelent, mint ahol a nézet áll. Az `App.tsx` ezért előtérbe kerüléskor és percenként
  újraszámolja a napot — de csak akkor lépteti, ha a nézet **követi a mait**. Aki szándékosan
  nyitott meg egy múltbeli napot, azt nem rántjuk el róla.
