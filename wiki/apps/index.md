# Futásidejű felületek

Egy oldal top-level futásidejű felületenként (belépési pontonként). Ide ritkán kell írni — csak
akkor, ha új app vagy új futtatható felület jelenik meg.

## Jelenlegi

A projektnek **egyetlen** futásidejű felülete van, és ez tudatos döntés:

**A PWA + az API ugyanabból a konténerből, ugyanazon a porton (3000), ugyanazon a domainen.**
A Hono kezeli a `/api/*` útvonalakat, minden más kérésre a Vite statikus buildjét szolgálja ki,
ismeretlen útvonalra pedig az `index.html`-t.

Ez azért **nem** két felület, mert egyetlen artefaktként deployol, egyetlen verziója van, és a
frontend meg a backend nem tud elcsúszni egymástól — lásd
[egy konténeres deploy](/decisions/2026-07-27-egy-konteneres-deploy.md).

A szerkezetet az [architektúra](/architecture.md) írja le. Amíg egyetlen felület van, ez a mappa
üres marad.
