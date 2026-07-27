import { useEffect, useRef, useState } from 'react';
import { Block, Button, Sheet, Toast } from 'konsta/react';
import { ICON_NAMES, Icon } from '../icons';
import { useStore } from '../App';
import { addMarker, deleteMarker, saveActivity } from '../store';
import {
  DAY_START_HOUR,
  NONE,
  dayKey,
  dayStartMs,
  fmtClock,
  fmtTime,
  liveActivities,
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

const STUCK_MS = 12 * 3600_000;
const UNDO_MS = 7000;

/** A napsáv nem a teljes logikai napot mutatja: 06:00 és éjfél között sűrűbb
 *  és olvashatóbb, mert a hajnali órákban úgysem történik semmi. */
const STRIP_FROM_H = 6;

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

  const live = liveActivities(activities);
  // A futó tevékenység a TELJES listából keresendő ki: ha közben archiválták,
  // a marker attól még fut, és meg kell nevezni. A `live` csak a gombokhoz kell.
  const running = runningMarker(markers, now);
  const runningAct = running ? activities.find((a) => a.id === running.activityId) : null;
  const elapsed = running ? now - running.at : 0;
  const stuck = elapsed > STUCK_MS;

  const today = dayKey(now, DAY_START_HOUR);
  const from = dayStartMs(today, STRIP_FROM_H);
  const to = dayStartMs(shiftDayKey(today, 1), 0); // éjfél
  const segments = segmentsFor(markers, from, to, now);
  const nowPct = ((Math.min(Math.max(now, from), to) - from) / (to - from)) * 100;
  const colorOf = (id: string) => activities.find((a) => a.id === id)?.color ?? '#8b93a5';

  async function record(activityId: string, label: string) {
    // Mindig a jelen pillanat. Az utólagos javítás a Nap nézet dolga, ahol a
    // határok húzhatók — így a rögzítés egyetlen koppintás marad.
    const row = await addMarker(activityId, now);
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
      sort: (live.at(-1)?.sort ?? 0) + 10,
      archived: false,
    });
    setDraft(null);
    if (row) await record(row.id, row.label);
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
      </section>

      {stuck && <p className="current__warn">Több mint 12 órája fut.</p>}

      <button className="daystrip" onClick={() => onOpenDay(today)} aria-label="Mai nap megnyitása">
        <div className="daystrip__track">
          {segments.map((s) => (
            <div
              key={s.markerId}
              className="daystrip__seg"
              style={{
                left: `${((s.start - from) / (to - from)) * 100}%`,
                width: `max(2px, ${((s.end - s.start) / (to - from)) * 100}%)`,
                background: colorOf(s.activityId),
              }}
            />
          ))}
          {now >= from && now <= to && (
            <div className="daystrip__now" style={{ left: `${nowPct}%` }} />
          )}
        </div>
        <div className="daystrip__axis">
          <span>06</span>
          <span>10</span>
          <span>14</span>
          <span>18</span>
          <span>22</span>
          <span>24</span>
        </div>
      </button>

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
