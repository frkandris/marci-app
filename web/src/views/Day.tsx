import { useEffect, useMemo, useRef, useState } from 'react';
import { usePinch } from '@use-gesture/react';
import { Block, Button, Sheet, Toast } from 'konsta/react';
import { Icon } from '../icons';
import { useStore } from '../App';
import { addMarker, deleteMarker, ensureDayLoaded, updateMarker } from '../store';
import {
  DAY_START_HOUR,
  NONE,
  dayBounds,
  dayKey,
  dragBounds,
  fmtDayLong,
  dailyTotals,
  fmtDuration,
  fmtTime,
  liveActivities,
  markersIn,
  nextOf,
  previousOf,
  runningMarker,
  segmentsFor,
  shiftDayKey,
  snap,
  retimeMarker,
  toTimeInput,
} from '../model';

interface Drag {
  id: string;
  startY: number;
  origAt: number;
  at: number;
  min: number;
  max: number;
}

export function Day({
  dayKey: key,
  setDayKey,
}: {
  dayKey: string;
  setDayKey: (k: string) => void;
}) {
  const { markers, activities } = useStore();
  const [pxPerHour, setPxPerHour] = useState(128);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  const [newAt, setNewAt] = useState<number | null>(null);
  const [undo, setUndo] = useState<{ id: string; at: number } | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [from, to] = dayBounds(key, DAY_START_HOUR);
  const now = Date.now();
  // A byId a TELJES listából épül (az archiváltakkal együtt), különben a régi
  // napok archivált típusú szegmensei név és szín nélkül maradnának.
  const live = liveActivities(activities);
  const byId = useMemo(() => new Map(activities.map((a) => [a.id, a])), [activities]);

  // Húzás közben a preview-t a markerlistába vetítjük, hogy a szomszédos
  // szegmensek hossza élőben újraszámolódjon.
  const preview = useMemo(
    () => (drag ? markers.map((m) => (m.id === drag.id ? { ...m, at: drag.at } : m)) : markers),
    [markers, drag],
  );

  const segments = segmentsFor(preview, from, to, now);
  const totals = useMemo(() => dailyTotals(segments).slice(0, 4), [segments]);
  const handles = markersIn(preview, from, to);

  const totalHours = (to - from) / 3600_000;
  /** Órákban mért eltolás a nap kezdetétől — a CSS ebből számol pozíciót. */
  const hOf = (t: number) => (t - from) / 3600_000;

  const hours = useMemo(() => {
    const out: Array<{ t: number; label: string }> = [];
    for (let t = from; t < to; t += 3600_000) {
      out.push({ t, label: String(new Date(t).getHours()).padStart(2, '0') });
    }
    return out;
  }, [from, to]);

  // A nap tetejéről indulni haszontalan: hajnali 4-kor sosincs semmi. Oda
  // tekerünk, ahol épp állunk — vagy a nap első rögzítéséhez, ha múltbeli nap.
  useEffect(() => {
    void ensureDayLoaded(key);
  }, [key]);

  // Naponta EGYSZER pozicionálunk. Ha a nap kiesett a betöltött ablakból, a
  // markerek csak később érkeznek meg — ezért a `markers` is függőség, de a
  // jelölő megakadályozza, hogy minden szerkesztés visszaugrasson.
  const scrolledFor = useRef<string | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || scrolledFor.current === key) return;
    const t = Date.now();
    const isToday = t >= from && t < to;
    const first = segmentsFor(markers, from, to, t)[0]?.start;
    // Múltbeli napnál megvárjuk az adatot, különben 04:00-ra tekernénk.
    if (!isToday && first === undefined) return;
    const target = isToday ? t : first!;
    el.scrollTop = Math.max(0, ((target - from) / 3600_000) * pxPerHour - el.clientHeight * 0.4);
    scrolledFor.current = key;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, markers]);

  // --- Csippentéses nagyítás ------------------------------------------------
  // A @use-gesture kezeli a mutatók követését, a gesztus kezdetét/végét és a
  // trackpad ctrl+görgetést is. Mi csak a SKÁLÁT állítjuk (px/óra) — nem
  // vizuális transzformot, mert akkor a feliratok is nyúlnának.
  const pinchBase = useRef({ px: 128, midT: 0, midY: 0 });

  usePinch(
    ({ first, last, offset: [scale], origin: [, oy], memo }) => {
      const el = scrollRef.current;
      const track = trackRef.current;
      if (!el || !track) return memo;
      if (first) {
        const rect = el.getBoundingClientRect();
        const midY = oy - rect.top;
        pinchBase.current = {
          px: pxPerHour,
          midT: from + ((midY + el.scrollTop) / pxPerHour) * 3600_000,
          midY,
        };
      }
      const b = pinchBase.current;
      const next = Math.min(Math.max(b.px * scale, 24), 400);
      // A gesztus ALATT csak egy CSS-változót írunk: nincs React-render, ezért
      // nem akadozik. Az állapotot a gesztus VÉGÉN szinkronizáljuk egyszer.
      track.style.setProperty('--pxh', String(next));
      el.scrollTop = ((b.midT - from) / 3600_000) * next - b.midY;
      if (last) setPxPerHour(next);
      return memo;
    },
    {
      target: scrollRef,
      eventOptions: { passive: false },
      scaleBounds: { min: 0.2, max: 4 },
      from: () => [1, 0],
    },
  );

  function onHandleDown(e: React.PointerEvent, id: string, at: number) {
    e.preventDefault();
    // A capture dobhat, ha a pointer közben elveszett; ilyenkor a húzás
    // MÉG mindig induljon el, különben a fogantyú némán süket marad.
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* nem kritikus */
    }
    const [min, max] = dragBounds(markers, id);
    setDrag({ id, startY: e.clientY, origAt: at, at, min, max });
  }

  function onHandleMove(e: React.PointerEvent) {
    if (!drag) return;
    const dt = ((e.clientY - drag.startY) / pxPerHour) * 3600_000;
    // A felső korlát a JELEN is: az utolsó markernek nincs szomszédja, ezért
    // enélkül a jövőbe lenne húzható — pont az az árva állapot, amit az üres
    // sávra koppintásnál külön tiltunk.
    const upper = Math.min(drag.max, Date.now());
    const next = Math.min(Math.max(snap(drag.origAt + dt), drag.min), upper);
    setDrag({ ...drag, at: next });
  }

  async function onHandleUp() {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (d.at === d.origAt) {
      // Nem húzás volt, hanem koppintás: a fogantyú 44 pt-os találati sávja
      // ráfekszik a szegmensre, ezért enélkül a csík nagy része "süket" lenne.
      setSheet(d.id);
      return;
    }
    // Csak SIKERES mentés után jelentjük sikernek: hiba esetén az
    // `updateMarker` null-t ad és hibasávot mutat, a "Időpont módosítva"
    // pedig hazugság lenne — ráadásul egy meg sem történt változást
    // ajánlana visszavonásra.
    const saved = await updateMarker(d.id, { at: d.at });
    if (!saved) return;
    setUndo({ id: d.id, at: d.origAt });
    setTimeout(() => setUndo((u) => (u?.id === d.id ? null : u)), 6000);
  }

  /**
   * Koppintás a sáv ÜRES részére: új esemény az adott időpontban — mint a
   * naptárakban. A szegmensek és a fogantyúk saját kezelőt kapnak, ezért ide
   * csak a tényleg üres területen érkezik esemény.
   */
  function onTrackClick(e: React.MouseEvent) {
    const track = trackRef.current;
    if (!track || e.target !== track) return;
    const y = e.clientY - track.getBoundingClientRect().top;
    const px = Number(getComputedStyle(track).getPropertyValue('--pxh')) || pxPerHour;
    const t = snap(from + (y / px) * 3600_000);
    // Jövőbe nem lehet rögzíteni: az még nem történt meg. A `segmentsFor`
    // amúgy is levágja a jelennél, ezért egy jövőbeli markerből csak egy
    // árva fogantyú lenne — szegmens nélkül.
    if (t > Date.now()) return;
    setNewAt(t);
  }

  const sheetMarker = sheet ? markers.find((m) => m.id === sheet) : null;
  const endMarker = sheetMarker ? nextOf(markers, sheetMarker.id) : null;

  /**
   * Folytatás: a szegmenst lezáró „Vége" marker ELDOBÁSA, amitől az eredeti
   * szegmens folytatódik tovább — nem új esemény jön létre.
   *
   * Csak akkor kínáljuk fel, ha a szegmenst közvetlenül egy `__none__` zárja,
   * és az a LEGUTOLSÓ marker. Így egyértelmű, mit jelent: „mégsem ért véget".
   * A hozzáadódó idő a gombon látszik, mert a lezárás óta eltelt idő
   * visszamenőleg ehhez a tevékenységhez kerül.
   */
  const closer =
    sheetMarker && sheetMarker.activityId !== NONE ? nextOf(markers, sheetMarker.id) : null;
  const canResume =
    !!closer &&
    closer.activityId === NONE &&
    nextOf(markers, closer.id) === null &&
    runningMarker(markers) === null;

  /**
   * A szegmens „törlése" rendes tevékenységnél NEM a marker eldobása: az csak
   * összevonná az előzővel, vagyis az előző tevékenységnek tulajdonítana olyan
   * időt, ami nem az volt. Helyette a sáv NEM RÖGZÍTETT lesz.
   *
   * Két esetben viszont a markert magát dobjuk el:
   *  - a marker MÁR `__none__` (egy „Vége" határ) — ilyenkor a `__none__`-ra
   *    állítás no-op lenne, és a Törlés gomb látszólag nem csinálna semmit;
   *  - az előző szegmens már úgyis lyuk — ne halmozódjanak az üres határok.
   */
  async function clearSegment(id: string) {
    const self = markers.find((m) => m.id === id);
    const prev = previousOf(markers, id);
    if (self?.activityId === NONE || prev?.activityId === NONE) await deleteMarker(id);
    else await updateMarker(id, { activityId: NONE });
  }

  return (
    <div className="day">
      <header className="day__nav">
        <button onClick={() => setDayKey(shiftDayKey(key, -1))} aria-label="Előző nap">
          ‹
        </button>
        <div className="day__title">
          <strong>{fmtDayLong(key)}</strong>
          <button className="link" onClick={() => setDayKey(dayKey(Date.now()))}>
            Ma
          </button>
        </div>
        <button onClick={() => setDayKey(shiftDayKey(key, 1))} aria-label="Következő nap">
          ›
        </button>
      </header>

      {totals.length > 0 && (
        <div className="totals">
          {totals.map((t) => {
            const a = byId.get(t.activityId);
            return (
              <span key={t.activityId} className="totals__item">
                <i style={{ background: a?.color ?? '#8b93a5' }} />
                {a?.label ?? t.activityId}
                <b>{fmtDuration(t.ms)}</b>
              </span>
            );
          })}
        </div>
      )}

      <div className="day__scroll" ref={scrollRef}>
        <div
          className="day__track"
          ref={trackRef}
          onClick={onTrackClick}
          style={{ '--pxh': pxPerHour, '--hours': totalHours } as React.CSSProperties}
        >
          {hours.map((h) => (
            <div key={h.t} className="hourline" style={{ '--t': hOf(h.t) } as React.CSSProperties}>
              <span>{h.label}</span>
            </div>
          ))}

          {segments.map((s) => {
            const a = byId.get(s.activityId);
            return (
              <button
                key={s.markerId}
                className="seg"
                style={{
                  '--t': hOf(s.start),
                  '--d': hOf(s.end) - hOf(s.start),
                  background: a?.color ?? '#A9AEB8',
                } as React.CSSProperties}
                onClick={() => setSheet(s.markerId)}
              >
                <span className="seg__label">
                  <Icon name={a?.icon} size={13} />
                  {a?.label ?? s.activityId}
                  <em>{fmtDuration(s.end - s.start)}</em>
                  {(s.clippedStart || s.clippedEnd) && <i title="A napon túlnyúlik">↕</i>}
                </span>
              </button>
            );
          })}

          {handles.map((m) => (
            <div
              key={m.id}
              className={`handle ${drag?.id === m.id ? 'is-dragging' : ''}`}
              style={{ '--t': hOf(m.at) } as React.CSSProperties}
              onPointerDown={(e) => onHandleDown(e, m.id, m.at)}
              onPointerMove={onHandleMove}
              onPointerUp={() => void onHandleUp()}
              onPointerCancel={() => setDrag(null)}
              role="slider"
              tabIndex={0}
              aria-label={`${byId.get(m.activityId)?.label ?? 'Vége'} kezdete`}
              aria-valuetext={fmtTime(m.at)}
              onKeyDown={(e) => {
                const step = e.shiftKey ? 3600_000 : 300_000;
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  const [min, max] = dragBounds(markers, m.id);
                  const next = Math.min(
                    Math.max(m.at + (e.key === 'ArrowUp' ? -step : step), min),
                    Math.min(max, Date.now()),
                  );
                  void updateMarker(m.id, { at: next });
                }
              }}
            >
              <span className="handle__time">
                {fmtTime(drag?.id === m.id ? drag.at : m.at)}
              </span>
            </div>
          ))}

          {now >= from && now < to && (
            <>
              <div className="nowline" style={{ '--t': hOf(now) } as React.CSSProperties} />
              {/* A jövő nem rögzíthető — ez látszódjon is. */}
              <div className="future" style={{ '--t': hOf(now) } as React.CSSProperties} />
            </>
          )}
        </div>
      </div>

      {segments.length === 0 && (
        <p className="empty">Ezen a napon nincs rögzítés.</p>
      )}

      <Toast
        opened={!!undo}
        className="marci-toast"
        button={
          <Button rounded clear inline onClick={() => {
            if (undo) void updateMarker(undo.id, { at: undo.at });
            setUndo(null);
          }}>
            Visszavonás
          </Button>
        }
      >
        <span>Időpont módosítva</span>
      </Toast>

      <Sheet opened={newAt !== null} onBackdropClick={() => setNewAt(null)} className="marci-sheet">
        {newAt !== null && (
          <Block>
            <h3>Új esemény — {fmtTime(newAt)}</h3>
            <div className="sheet__grid">
              {live.map((a) => (
                <button
                  key={a.id}
                  className="chip"
                  style={{ '--c': a.color } as React.CSSProperties}
                  onClick={() => {
                    void addMarker(a.id, newAt);
                    setNewAt(null);
                  }}
                >
                  <Icon name={a.icon} size={16} />
                  {a.label}
                </button>
              ))}
              <button
                className="chip chip--none"
                onClick={() => {
                  void addMarker(NONE, newAt);
                  setNewAt(null);
                }}
              >
                <Icon name="stop" size={16} />
                Vége
              </button>
            </div>
            <div className="sheet__row">
              <Button rounded tonal onClick={() => setNewAt(null)}>
                Mégse
              </Button>
            </div>
          </Block>
        )}
      </Sheet>

      <Sheet opened={!!sheetMarker} onBackdropClick={() => setSheet(null)} className="marci-sheet">
        {sheetMarker && (
          <Block>
            <h3>{byId.get(sheetMarker.activityId)?.label ?? 'Vége'}</h3>

            <div className="times">
              <label className="times__field">
                <span className="eyebrow">Kezdet</span>
                <input
                  type="time"
                  value={toTimeInput(sheetMarker.at)}
                  onChange={(e) => {
                    const [min, max] = dragBounds(markers, sheetMarker.id);
                    const t = retimeMarker(sheetMarker.at, e.target.value);
                    void updateMarker(sheetMarker.id, {
                      at: Math.min(Math.max(t, min), Math.min(max, Date.now())),
                    });
                  }}
                />
              </label>

              <label className="times__field">
                <span className="eyebrow">Vége</span>
                {endMarker ? (
                  <input
                    type="time"
                    value={toTimeInput(endMarker.at)}
                    onChange={(e) => {
                      // A VÉGE a KÖVETKEZŐ marker kezdete — azt mozgatjuk, és
                      // az Ő SAJÁT logikai napjához horgonyzunk. Átéjszakázó
                      // alvásnál (22:00 -> 07:00) a kezdő marker az ELŐZŐ
                      // logikai naphoz tartozik: onnan számolva a 08:00 a
                      // kezdés ELÉ esne, és a korlát ~1 ms-ra omlasztaná a
                      // szegmenst.
                      const [min, max] = dragBounds(markers, endMarker.id);
                      const t = retimeMarker(endMarker.at, e.target.value);
                      void updateMarker(endMarker.id, {
                        at: Math.min(Math.max(t, min), Math.min(max, Date.now())),
                      });
                    }}
                  />
                ) : (
                  <span className="times__running">most is fut</span>
                )}
              </label>
            </div>

            <div className="sheet__grid">
              {live.map((a) => (
                <button
                  key={a.id}
                  className={`chip ${sheetMarker.activityId === a.id ? 'is-active' : ''}`}
                  style={{ '--c': a.color } as React.CSSProperties}
                  onClick={() => void updateMarker(sheetMarker.id, { activityId: a.id })}
                >
                  <Icon name={a.icon} size={16} />
                  {a.label}
                </button>
              ))}
            </div>

            {canResume && closer && (
              <div className="sheet__row">
                <Button
                  rounded
                  onClick={() => {
                    // A lezáró marker eldobása: az eredeti szegmens folytatódik.
                    void deleteMarker(closer.id);
                    setSheet(null);
                  }}
                >
                  Folytatás (+{fmtDuration(Date.now() - closer.at)})
                </Button>
              </div>
            )}

            <div className="sheet__row">
              <Button
                rounded
                outline
                colors={{ textIos: 'text-red-500', outlineBorderIos: 'border-red-500' }}
                onClick={() => {
                  void clearSegment(sheetMarker.id);
                  setSheet(null);
                }}
              >
                Törlés
              </Button>
              <Button rounded tonal onClick={() => setSheet(null)}>
                Kész
              </Button>
            </div>
          </Block>
        )}
      </Sheet>
    </div>
  );
}
