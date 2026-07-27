# Hibaboncolások

Egy oldal notable bugonként, `YYYY-MM-DD-<slug>.md` néven.

**Csak akkor írj ide**, ha a gyökérok **meglepő** volt, vagy ha a hibaosztály várhatóan
**visszatér**. A triviális javításokat, amiket a diff megmagyaráz, ne dokumentáld — a zajos wiki
rosszabb, mint a rövid.

Váz: Tünet / **Gyökérok** / Javítás / Tanulság. A gyökérok a teherhordó szakasz, és nem a tünet
átfogalmazása.

## Nyitott

Egyelőre nincs. A projektnek még nincs kódja.

## Megoldott

* [2026-07-27 — A confirm() befagyasztotta az egész appot](2026-07-27-confirm-blokkolta-a-renderert.md) - a natív dialógus blokkolja a renderert; a tanulság általánosítható

## Amire számítani lehet

Nem bugok, csak előre azonosított kockázatok — ha bekövetkeznek, **ide kerül a postmortem**:

* **Üres adatbázis deploy után** — hiányzó Coolify-volume a `/data`-n. A projekt legvalószínűbb incidense, mert semmi nem jelzi. [Runbook](/runbooks/mentes-visszaallitas.md)
* **A nap eleje üresen jelenik meg** — a napi lekérdezés nem hozta el a nap kezdete előtti utolsó markert. A [határjelölő modell](/decisions/2026-07-27-hatarjelolo-adatmodell.md) legkönnyebben elrontható pontja
* **A két telefon eltérő végállapotra konvergál** — hiányzó `device_id` holtversenytörés az LWW-ben. [Runbook](/runbooks/szinkron-hibaelharitas.md)
* **A telefonok régi kódot futtatnak deploy után** — beragadt service worker vagy cache-elt `index.html`. [iOS Safari PWA](/integrations/ios-safari-pwa.md)
