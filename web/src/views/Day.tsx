import { useEffect, useMemo, useRef, useState } from 'react';
import { Block, Button, Segmented, SegmentedButton, Sheet, Toast } from 'konsta/react';
import { Icon } from '../icons';
import { useStore } from '../App';
import { deleteMarker, updateMarker } from '../store';
import {
  DAY_START_HOUR,
  NONE,
  dayBounds,
  dayKey,
  dragBounds,
  fmtDayLong,
  fmtDuration,
  fmtTime,
  liveActivities,
  markersIn,
  segmentsFor,
  shiftDayKey,
  snap,
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
  const [pxPerHour, setPxPerHour] = useState(64);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);
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
  const handles = markersIn(preview, from, to);

  const height = ((to - from) / 3600_000) * pxPerHour;
  const yOf = (t: number) => ((t - from) / 3600_000) * pxPerHour;

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
    const el = scrollRef.current;
    if (!el) return;
    const t = Date.now();
    const first = segmentsFor(markers, from, to, t)[0]?.start;
    const target = t >= from && t < to ? t : (first ?? from);
    const y = ((target - from) / 3600_000) * pxPerHour;
    el.scrollTop = Math.max(0, y - el.clientHeight * 0.4);
    // A `markers` szándékosan NEM függőség: csak nézetváltáskor és
    // nagyításkor tekerünk, különben minden szerkesztés visszaugrana.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, pxPerHour]);

  function onHandleDown(e: React.PointerEvent, id: string, at: number) {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const [min, max] = dragBounds(markers, id);
    setDrag({ id, startY: e.clientY, origAt: at, at, min, max });
  }

  function onHandleMove(e: React.PointerEvent) {
    if (!drag) return;
    const dt = ((e.clientY - drag.startY) / pxPerHour) * 3600_000;
    const next = Math.min(Math.max(snap(drag.origAt + dt), drag.min), drag.max);
    setDrag({ ...drag, at: next });
  }

  async function onHandleUp() {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (d.at !== d.origAt) {
      await updateMarker(d.id, { at: d.at });
      setUndo({ id: d.id, at: d.origAt });
      setTimeout(() => setUndo((u) => (u?.id === d.id ? null : u)), 6000);
    }
  }

  const sheetMarker = sheet ? markers.find((m) => m.id === sheet) : null;

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

      <div className="day__zoom">
        <Segmented strong>
          {([32, 64, 128] as const).map((p) => (
            <SegmentedButton key={p} active={pxPerHour === p} onClick={() => setPxPerHour(p)}>
              {p === 32 ? 'Teljes nap' : p === 64 ? 'Normál' : 'Közeli'}
            </SegmentedButton>
          ))}
        </Segmented>
      </div>

      <div className="day__scroll" ref={scrollRef}>
        <div className="day__track" ref={trackRef} style={{ height }}>
          {hours.map((h) => (
            <div key={h.t} className="hourline" style={{ top: yOf(h.t) }}>
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
                  top: yOf(s.start),
                  height: Math.max(yOf(s.end) - yOf(s.start), 3),
                  background: a?.color ?? '#A9AEB8',
                }}
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
              style={{ top: yOf(m.at) }}
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
                    max,
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

          {now >= from && now < to && <div className="nowline" style={{ top: yOf(now) }} />}
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

      <Sheet opened={!!sheetMarker} onBackdropClick={() => setSheet(null)} className="marci-sheet">
        {sheetMarker && (
          <Block>
            <h3>
              {fmtTime(sheetMarker.at)} — {byId.get(sheetMarker.activityId)?.label ?? 'Vége'}
            </h3>
            <div className="sheet__grid">
              {live.map((a) => (
                <button
                  key={a.id}
                  className={`chip ${sheetMarker.activityId === a.id ? 'is-active' : ''}`}
                  style={{ '--c': a.color } as React.CSSProperties}
                  onClick={() => {
                    void updateMarker(sheetMarker.id, { activityId: a.id });
                    setSheet(null);
                  }}
                >
                  <Icon name={a.icon} size={16} />
                  {a.label}
                </button>
              ))}
              <button
                className={`chip chip--none ${sheetMarker.activityId === NONE ? 'is-active' : ''}`}
                onClick={() => {
                  void updateMarker(sheetMarker.id, { activityId: NONE });
                  setSheet(null);
                }}
              >
                <Icon name="stop" size={16} />
                Vége
              </button>
            </div>
            <div className="sheet__row">
              <Button rounded outline colors={{ textIos: 'text-red-500', outlineBorderIos: 'border-red-500' }}
                onClick={() => { void deleteMarker(sheetMarker.id); setSheet(null); }}>
                Törlés
              </Button>
              <Button rounded clear onClick={() => setSheet(null)}>Kész</Button>
            </div>
          </Block>
        )}
      </Sheet>
    </div>
  );
}
