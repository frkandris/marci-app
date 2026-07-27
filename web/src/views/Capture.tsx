import { useEffect, useState } from 'react';
import { useStore } from '../App';
import { addMarker } from '../store';
import {
  DAY_START_HOUR,
  NONE,
  dayBounds,
  dayKey,
  fmtClock,
  fmtTime,
  liveActivities,
  runningMarker,
  segmentsFor,
} from '../model';

const STUCK_MS = 12 * 3600_000;

export function Capture({ onOpenDay }: { onOpenDay: (key: string) => void }) {
  const { markers, activities } = useStore();
  const [now, setNow] = useState(Date.now());
  const [backdate, setBackdate] = useState(false);
  const [backTime, setBackTime] = useState('');

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

  const live = liveActivities(activities);
  const running = runningMarker(markers, now);
  const runningAct = running ? live.find((a) => a.id === running.activityId) : null;
  const elapsed = running ? now - running.at : 0;
  const stuck = elapsed > STUCK_MS;

  const today = dayKey(now, DAY_START_HOUR);
  const [from, to] = dayBounds(today);
  const segments = segmentsFor(markers, from, to, now);
  const colorOf = (id: string) => live.find((a) => a.id === id)?.color ?? '#A9AEB8';

  async function record(activityId: string) {
    if (backdate && backTime) {
      const [h, m] = backTime.split(':').map(Number);
      const d = new Date(now);
      d.setHours(h, m, 0, 0);
      // Ha a megadott idő a jövőben van, tegnapról van szó.
      const at = d.getTime() > now ? d.getTime() - 86_400_000 : d.getTime();
      await addMarker(activityId, at);
      setBackdate(false);
      setBackTime('');
    } else {
      await addMarker(activityId);
    }
  }

  return (
    <div className="capture">
      <section className={`current ${stuck ? 'is-stuck' : ''}`}>
        {running && runningAct ? (
          <>
            <div className="current__label">
              {runningAct.icon} {runningAct.label}
            </div>
            <div className="current__clock">{fmtClock(elapsed)}</div>
            <div className="current__since">{fmtTime(running.at)} óta</div>
            {stuck && (
              <p className="current__warn">
                Több mint 12 órája fut. Elfelejtettél „Vége"-t nyomni?
              </p>
            )}
          </>
        ) : (
          <>
            <div className="current__clock current__clock--idle">—</div>
            <div className="current__since">Nincs futó tevékenység</div>
          </>
        )}
      </section>

      <button className="daystrip" onClick={() => onOpenDay(today)} aria-label="Mai nap megnyitása">
        <div className="daystrip__track">
          {segments.map((s) => (
            <div
              key={s.markerId}
              className="daystrip__seg"
              style={{
                left: `${((s.start - from) / (to - from)) * 100}%`,
                width: `${Math.max(((s.end - s.start) / (to - from)) * 100, 0.4)}%`,
                background: colorOf(s.activityId),
              }}
            />
          ))}
          <div
            className="daystrip__now"
            style={{ left: `${((now - from) / (to - from)) * 100}%` }}
          />
        </div>
        <div className="daystrip__axis">
          <span>04</span>
          <span>10</span>
          <span>16</span>
          <span>22</span>
          <span>04</span>
        </div>
      </button>

      <div className="capture__head">
        <h2>Mi következik?</h2>
        <button
          className={`link ${backdate ? 'is-on' : ''}`}
          onClick={() => setBackdate((v) => !v)}
        >
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
            onClick={() => void record(a.id)}
            disabled={backdate && !backTime}
          >
            <span className="bigbtn__icon" aria-hidden="true">
              {a.icon}
            </span>
            {a.label}
          </button>
        ))}
        <button
          className="bigbtn bigbtn--none"
          onClick={() => void record(NONE)}
          disabled={backdate && !backTime}
        >
          <span className="bigbtn__icon" aria-hidden="true">
            ⏹
          </span>
          Vége
        </button>
      </div>
    </div>
  );
}
