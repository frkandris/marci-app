# Döntések

Egy oldal döntésenként, `YYYY-MM-DD-<slug>.md` néven. A **Miért** szakasz a teherhordó: a diffből
a *mit* mindig kiolvasható, a *miért* soha.

Akkor írj ide, ha architekturális vagy tervezési döntés született, és az indoka nem nyilvánvaló a
kódból. Ha nyilvánvaló, hagyd ki.

Váz: Kontextus / Mérlegelt opciók / Döntés / **Miért** / Következmények.

## Aktív

* [2026-07-27 — PWA natív iOS app helyett](2026-07-27-pwa-nativ-ios-helyett.md) - nincs Xcode és nincs fejlesztői fiók; az ingyenes sideload 7 naponta lejárna
* [2026-07-27 — Határjelölő adatmodell intervallumok helyett](2026-07-27-hatarjelolo-adatmodell.md) - a húzogatás egyetlen mező írása, az átfedésmentesség konstrukcióból következik
* [2026-07-27 — Offline-first, LWW-szinkronnal](2026-07-27-offline-first-lww-szinkron.md) - a UI soha nem vár hálózatra; `edited_at` dönt, `seq` kurzoroz
* [2026-07-27 — Nincs hitelesítés](2026-07-27-nincs-hitelesites.md) - tudatosan vállalt kockázat, dokumentált visszaúttal
* [2026-07-27 — SQLite adattár](2026-07-27-sqlite-adattar.md) - egy fájl egy volume-on; a mentés egy `cp`
* [2026-07-27 — Egy konténer, egy domain](2026-07-27-egy-konteneres-deploy.md) - a Hono szolgálja ki a statikus buildet is; nincs CORS, nincs második service
* [2026-07-27 — Logikai napkezdet 04:00-kor](2026-07-27-logikai-napkezdet.md) - az éjszakai alvás nem törik ketté a napi soron

## Felülírt

Egyelőre nincs. Ha egy döntést egy későbbi felülír, **ide kerül át** — nem törlődik —, és a
frontmatterében `status: deprecated` lesz, a törzsében pedig link az új döntésre.
