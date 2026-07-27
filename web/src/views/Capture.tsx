import { useEffect, useRef, useState } from 'react';
import { Block, Button, Sheet, Toast } from 'konsta/react';
import { ICON_NAMES, Icon } from '../icons';
import { useStore } from '../App';
import { addMarker, deleteMarker, saveActivity } from '../store';
import {
  DAY_START_HOUR,
  activeMarkers,
  NONE,
  dayKey,
  dayStartMs,
  fmtClock,
  fmtTime,
  liveActivities,
  previousOf,
  rankedActivities,
  runningMarker,
  segmentsFor,
  shiftDayKey,
} from '../model';

const PRESETS = [
  '#4A56C4', '#8B6FD0', '#C0559B', '#D9634E',
  '#DE8A2C', '#8AA82E', '#3FA36E', '#2A9CBE',
];
const PICKABLE = ICON_NAMES.filter((n) => !['record', 'list', 'grid', 'sliders'].includes(n));
const slug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Meddig ajánljuk fel a „mégsem ez volt" visszalépést a futó tevékenységen. */
const OOPS_WINDOW_MS = 10 * 60_000;
const STUCK_MS = 12 * 3600_000;
const UNDO_MS = 7000;

/** A napsáv nem a teljes logikai napot mutatja: 06:00 és éjfél között sűrűbb
 *  és olvashatóbb, mert a hajnali órákban úgysem történik semmi. */
const STRIP_FROM_H = 6;
/** Ráközelített skála: 18 óra így a képernyő ~2x-ét teszi ki, tehát görgethető. */
const STRIP_PX_PER_H = 44;

/**
 * A főképernyő. A cél: a telefon előkapásától a rögzítésig egy koppintás és
 * nulla görgetés — a gombrács mindig kifér, és a hüvelykujjal elérhető alsó
 * kétharmadban van. Megerősítő párbeszéd helyett visszavonás.
 */
export function Capture({ onOpenDay }: { onOpenDay: (key: string) => void }) {
  const { markers, activities } = useStore();
  const [now, setNow] = useState(Date.now());
  const [undo, setUndo] = useState<{ id: string; label: string } | null>(null);
  const [draft, setDraft] = useState<{ label: string; icon: string; color: string } | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const tapStart = useRef<{ x: number; scroll: number } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Másodpercenként, nem requestAnimationFrame-mel: háttérben az iOS lassítja
  // vagy leállítja az időzítőket, ezért visszatéréskor újraigazítunk.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    const resync = () => setNow(Date.now());
    document.addEventListener('visibilitychange', resync);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', resync);
    };
  }, []);

  useEffect(() => () => void (undoTimer.current && clearTimeout(undoTimer.current)), []);

  // A sáv a jelen pillanatra álljon be — különben a nap elején kezdene, ami
  // este a leghasznosabb részt kitolná a képernyőről.
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    el.scrollLeft = Math.max(0, (nowPct / 100) * stripW - el.clientWidth * 0.62);
    // Csak induláskor pozicionálunk; utána a felhasználó görgetése az úr.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Használat szerinti sorrend, AZONNAL újraszámolva: a most rögzített
  // tevékenység rögtön előrelép. A pontszám a gyakoriságot és a frissességet
  // együtt fejezi ki (7 napos felezés).
  const allLive = liveActivities(activities);
  const live = rankedActivities(allLive, markers, now);
  // A futó tevékenység a TELJES listából keresendő ki: ha közben archiválták,
  // a marker attól még fut, és meg kell nevezni. A `live` csak a gombokhoz kell.
  const today = dayKey(now, DAY_START_HOUR);
  const running = runningMarker(markers, now);
  const runningAct = running ? activities.find((a) => a.id === running.activityId) : null;
  const elapsed = running ? now - running.at : 0;
  const stuck = elapsed > STUCK_MS;

  /**
   * Téves koppintás visszavonása. A LEGUTOLSÓ markerre vonatkozik — akkor is,
   * ha az a „Vége" (`__none__`), mert azt is el lehet nyomni tévedésből. A
   * marker törlésével az ELŐZŐ tevékenység folytatódik onnan, ahol abbamaradt.
   */
  const started = activeMarkers(markers).filter((m) => m.at <= now);
  const lastMarker = started[started.length - 1] ?? null;
  const oops = lastMarker && now - lastMarker.at < OOPS_WINDOW_MS ? lastMarker : null;
  const prevMarker = oops ? previousOf(markers, oops.id) : null;
  const prevAct = prevMarker ? activities.find((a) => a.id === prevMarker.activityId) : null;
  const oopsLabel = prevAct?.label ?? (prevMarker ? 'Vége' : null);

  const from = dayStartMs(today, STRIP_FROM_H);
  const to = dayStartMs(shiftDayKey(today, 1), 0); // éjfél
  const segments = segmentsFor(markers, from, to, now);
  const nowPct = ((Math.min(Math.max(now, from), to) - from) / (to - from)) * 100;
  const stripHours = (to - from) / 3600_000;
  const stripW = stripHours * STRIP_PX_PER_H;
  const ticks = Array.from({ length: Math.floor(stripHours / 2) + 1 }, (_, i) => {
    const h = STRIP_FROM_H + i * 2;
    return { h: h % 24, pct: ((i * 2) / stripHours) * 100 };
  });
  const colorOf = (id: string) => activities.find((a) => a.id === id)?.color ?? '#8b93a5';

  async function record(activityId: string, label: string) {
    // FRISS időbélyeg, nem a másodpercenként frissülő `now`: két gyors
    // koppintás különben azonos `at`-et kapna, és a sorrendjüket a véletlen
    // UUID döntené el — a „Vége" akár a tevékenység ELÉ kerülhetne.
    const row = await addMarker(activityId, Date.now());
    if (!row) return;
    // Megerősítés helyett visszavonás: a téves koppintás olcsón javítható, a
    // helyes rögzítés viszont nem drágul meg egy párbeszéddel.
    setUndo({ id: row.id, label });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
  }

  /** Új tevékenység létrehozása ÉS azonnali indítása, egy lépésben. */
  async function createAndStart() {
    if (!draft?.label.trim()) return;
    const taken = new Set(activities.map((a) => a.id));
    let id = slug(draft.label) || 't';
    if (taken.has(id)) {
      let i = 2;
      while (taken.has(`${id}-${i}`)) i++;
      id = `${id}-${i}`;
    }
    const row = await saveActivity({
      id,
      label: draft.label.trim(),
      icon: draft.icon,
      color: draft.color,
      // A `live` HASZNÁLAT szerint van rendezve, nem `sort` szerint — ezért
      // a legnagyobb kézi sort-ból számolunk, különben ütköző értéket kapna.
      sort: Math.max(0, ...allLive.map((a) => a.sort)) + 10,
      archived: false,
    });
    // Sikertelen mentésnél NE dobjuk el a beírt adatokat — a hibasáv jelzi a
    // bajt, a felhasználó pedig újrapróbálhatja.
    if (!row) return;
    setDraft(null);
    await record(row.id, row.label);
  }

  return (
    <div className="capture">
      <section className={`current ${stuck ? 'is-stuck' : ''}`}>
        {running && runningAct ? (
          <>
            <div className="current__label">
              <span className="chipicon" style={{ background: runningAct.color }}>
                <Icon name={runningAct.icon} size={16} />
              </span>
              {runningAct.label}
            </div>
            <div className="current__clock">{fmtClock(elapsed)}</div>
            <div className="current__since">{fmtTime(running.at)} óta</div>
          </>
        ) : (
          <>
            <div className="current__clock current__clock--idle">–:––</div>
            <div className="current__since">Nincs futó tevékenység</div>
          </>
        )}

        {oops && (
          <button
            className="oops"
            onClick={() => {
              void deleteMarker(oops.id);
              setUndo(null);
            }}
          >
            {oops.activityId === NONE ? 'Mégsem ért véget' : 'Mégsem ez volt'}
            {oopsLabel ? ` — vissza: ${oopsLabel}` : ''}
          </button>
        )}
      </section>

      {stuck && <p className="current__warn">Több mint 12 órája fut.</p>}

      <div className="daystrip">
        <div className="daystrip__scroll" ref={stripRef}
          onPointerDown={(e) => {
            tapStart.current = { x: e.clientX, scroll: stripRef.current?.scrollLeft ?? 0 };
          }}
          onPointerUp={(e) => {
            // Koppintás vs. görgetés: csak elmozdulás nélküli érintés navigál.
            const t = tapStart.current;
            tapStart.current = null;
            if (!t) return;
            const moved = Math.abs(e.clientX - t.x) > 8 ||
              Math.abs((stripRef.current?.scrollLeft ?? 0) - t.scroll) > 4;
            if (!moved) onOpenDay(today);
          }}
        >
          <div className="daystrip__inner" style={{ width: stripW }}>
            <div className="daystrip__track">
              {segments.map((sg) => (
                <div
                  key={sg.markerId}
                  className="daystrip__seg"
                  style={{
                    left: `${((sg.start - from) / (to - from)) * 100}%`,
                    width: `max(2px, ${((sg.end - sg.start) / (to - from)) * 100}%)`,
                    background: colorOf(sg.activityId),
                  }}
                />
              ))}
              {now >= from && now <= to && (
                <div className="daystrip__now" style={{ left: `${nowPct}%` }} />
              )}
            </div>
            <div className="daystrip__axis">
              {ticks.map((t) => (
                <span key={t.h} style={{ left: `${t.pct}%` }}>
                  {String(t.h).padStart(2, '0')}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid">
        {live.map((a) => (
          <button
            key={a.id}
            className="bigbtn"
            style={{ '--c': a.color } as React.CSSProperties}
            onClick={() => void record(a.id, a.label)}
          >
            <span className="bigbtn__icon">
              <Icon name={a.icon} size={19} />
            </span>
            {a.label}
          </button>
        ))}
        <button
          className="bigbtn bigbtn--new"
          onClick={() => setDraft({ label: '', icon: 'star', color: PRESETS[live.length % 8] })}
        >
          <span className="bigbtn__icon">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M11 4a1 1 0 0 1 2 0v7h7a1 1 0 0 1 0 2h-7v7a1 1 0 0 1-2 0v-7H4a1 1 0 0 1 0-2h7V4z" />
            </svg>
          </span>
          Új
        </button>
        <button
          className="bigbtn bigbtn--none"
          onClick={() => void record(NONE, 'Vége')}
        >
          <span className="bigbtn__icon">
            <Icon name="stop" size={19} />
          </span>
          Vége
        </button>
      </div>

      <Sheet opened={!!draft} onBackdropClick={() => setDraft(null)} className="marci-sheet">
        {draft && (
          <Block>
            <div className="preview" style={{ '--c': draft.color } as React.CSSProperties}>
              <span className="chipicon chipicon--lg" style={{ background: draft.color }}>
                <Icon name={draft.icon} size={22} />
              </span>
              {draft.label || 'Új tevékenység'}
            </div>

            <input
              className="bigfield"
              value={draft.label}
              placeholder="Név"
              autoFocus
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            />

            <div className="picker">
              {PICKABLE.map((n) => (
                <button
                  key={n}
                  className={`pickbtn ${draft.icon === n ? 'is-active' : ''}`}
                  onClick={() => setDraft({ ...draft, icon: n })}
                  aria-label={n}
                >
                  <Icon name={n} size={20} />
                </button>
              ))}
            </div>

            <div className="picker picker--colors">
              {PRESETS.map((c) => (
                <button
                  key={c}
                  className={`pickbtn pickbtn--color ${draft.color.toUpperCase() === c ? 'is-active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setDraft({ ...draft, color: c })}
                  aria-label={`Szín ${c}`}
                />
              ))}
            </div>

            <div className="sheet__row">
              <Button rounded onClick={() => void createAndStart()} disabled={!draft.label.trim()}>
                Létrehoz és indít
              </Button>
              <Button rounded clear onClick={() => setDraft(null)}>
                Mégse
              </Button>
            </div>
          </Block>
        )}
      </Sheet>

      <Toast
        opened={!!undo}
        className="marci-toast"
        button={
          <Button rounded clear inline onClick={() => {
            if (undo) void deleteMarker(undo.id);
            setUndo(null);
          }}>
            Visszavonás
          </Button>
        }
      >
        <span>{undo?.label} rögzítve</span>
      </Toast>
    </div>
  );
}
