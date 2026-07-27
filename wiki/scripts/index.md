# Scriptek és CLI-k

Egy oldal notable scriptenként vagy parancssori eszközönként. Akkor írj ide, ha script vagy
parancs került be, átnevezésre került vagy megszűnt — és a létezése nem magától értetődő.

Az npm scripteket ne sorold fel egyesével: a `package.json` az igazságforrás. Ide az kerül, aminek
a **használata vagy a viselkedése** igényel magyarázatot.

## Jelenlegi

Egyelőre nincs — a projektnek még nincs kódja.

## Ami várhatóan ide kerül

* **A mentési cron** — nem npm script, hanem szerveroldali cron. Jelenleg a
  [mentés-runbookban](/runbooks/mentes-visszaallitas.md) él parancsként. Ha valaha fájlba kerül a
  repóban, ide is egy oldal.
* **Migrációs lépcső** — a `PRAGMA user_version` alapú sorszámozott migráció futtatója. A
  viselkedése (mikor fut, mi történik hiba esetén) magyarázatot fog igényelni.
