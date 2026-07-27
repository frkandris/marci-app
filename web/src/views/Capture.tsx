import { useEffect, useRef, useState } from 'react';
import { Icon } from '../icons';
import { useStore } from '../App';
import { addMarker, deleteMarker } from '../store';
import {
  DAY_START_HOUR,
  NONE,
  dayKey,
  dayStartMs,
  fmtClock,
  fmtTime,
  liveActivities,
  runningMarker,
  sameClockPreviousDay,
  segmentsFor,
  shiftDayKey,
} from '../model';

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
  const [backdate, setBackdate] = useState(false);
  const [backTime, setBackTime] = useState('');
  const [undo, setUndo] = useState<{ id: string; label: string } | null>(null);
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
    let at = now;
    if (backdate && backTime) {
      const [h, m] = backTime.split(':').map(Number);
      const d = new Date(now);
      d.setHours(h, m, 0, 0);
      // Ha a megadott idő a jövőben van, tegnapról van szó. NAPTÁRI léptetéssel,
      // nem −24 órával: az óraátállítás napján az elcsúsztatná a kért időpontot.
      at = d.getTime() > now ? sameClockPreviousDay(d.getTime()) : d.getTime();
      setBackdate(false);
      setBackTime('');
    }
    const row = await addMarker(activityId, at);
    if (!row) return;
    // Megerősítés helyett visszavonás: a téves koppintás olcsón javítható, a
    // helyes rögzítés viszont nem drágul meg egy párbeszéddel.
    setUndo({ id: row.id, label });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
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

      <div className="capture__head">
        <h2 className="eyebrow">Mi következik?</h2>
        <button className={`link ${backdate ? 'is-on' : ''}`} onClick={() => setBackdate((v) => !v)}>
          {backdate ? 'Mégis most' : 'Nem most kezdődött?'}
        </button>
      </div>

      {backdate && (
        <input
          className="timeinput"
          type="time"
          value={backTime}
          onChange={(e) => setBackTime(e.target.value)}
          aria-label="Kezdés időpontja"
        />
      )}

      <div className="grid">
        {live.map((a) => (
          <button
            key={a.id}
            className="bigbtn"
            style={{ '--c': a.color } as React.CSSProperties}
            onClick={() => void record(a.id, a.label)}
            disabled={backdate && !backTime}
          >
            <span className="bigbtn__icon">
              <Icon name={a.icon} size={19} />
            </span>
            {a.label}
          </button>
        ))}
        <button
          className="bigbtn bigbtn--none"
          onClick={() => void record(NONE, 'Vége')}
          disabled={backdate && !backTime}
        >
          <span className="bigbtn__icon">
            <Icon name="stop" size={19} />
          </span>
          Vége
        </button>
      </div>

      {undo && (
        <div className="toast">
          <span>
            <strong>{undo.label}</strong> rögzítve
          </span>
          <button
            onClick={() => {
              void deleteMarker(undo.id);
              setUndo(null);
            }}
          >
            Visszavonás
          </button>
        </div>
      )}
    </div>
  );
}
