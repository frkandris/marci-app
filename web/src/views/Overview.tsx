import { useMemo, useState } from 'react';
import { useStore } from '../App';
import { loadMoreDays } from '../store';
import {
  DAY_START_HOUR,
  dayBounds,
  dayKey,
  fmtDay,
  fmtDuration,
  fmtTime,
  segmentsFor,
  shiftDayKey,
} from '../model';
import { Icon } from '../icons';

interface Selection {
  activityId: string;
  /** A KONKRÉTAN megkoppintott szegmens — ennek az idejét mutatjuk. */
  start: number;
  end: number;
  dayKey: string;
}

export function Overview({ onOpenDay }: { onOpenDay: (key: string) => void }) {
  const { markers, activities, daysLoaded, loading } = useStore();
  const [sel, setSel] = useState<Selection | null>(null);

  // A byId a TELJES listából épül, hogy az archivált típusok régi szegmensei
  // is nevet és színt kapjanak.
  const byId = useMemo(() => new Map(activities.map((a) => [a.id, a])), [activities]);
  const now = Date.now();

  const days = useMemo(() => {
    const today = dayKey(now, DAY_START_HOUR);
    return Array.from({ length: daysLoaded }, (_, i) => shiftDayKey(today, -i));
  }, [daysLoaded, now]);

  const selAct = sel ? byId.get(sel.activityId) : null;

  return (
    <div className="overview" onClick={() => setSel(null)}>
      <div className="overview__axis">
        {[4, 8, 12, 16, 20, 0, 4].map((h, i) => (
          <span key={i}>{String(h).padStart(2, '0')}</span>
        ))}
      </div>

      <div className="overview__rows">
        {days.map((key) => {
          const [from, to] = dayBounds(key, DAY_START_HOUR);
          const segs = segmentsFor(markers, from, to, now);
          return (
            <div className="row" key={key}>
              <button
                className="row__label"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDay(key);
                }}
              >
                {fmtDay(key)}
              </button>
              <div className="row__track">
                {segs.map((s) => {
                  const a = byId.get(s.activityId);
                  // Kijelöléskor MINDEN nap azonos kategóriájú szegmense keretet
                  // kap — így ránézésre látszik, hogyan mozog napról napra.
                  const marked = sel?.activityId === s.activityId;
                  const exact = marked && sel!.start === s.start;
                  return (
                    <button
                      key={s.markerId}
                      className={`row__seg${marked ? ' is-marked' : ''}${exact ? ' is-exact' : ''}`}
                      style={{
                        left: `${((s.start - from) / (to - from)) * 100}%`,
                        // Minimális szélesség: enélkül egy azonnal javított,
                        // pár másodperces marker nyom nélkül eltűnne.
                        width: `max(2px, ${((s.end - s.start) / (to - from)) * 100}%)`,
                        background: a?.color ?? '#A9AEB8',
                      }}
                      aria-label={`${a?.label ?? s.activityId}, ${fmtTime(s.start)}–${fmtTime(s.end)}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSel({ activityId: s.activityId, start: s.start, end: s.end, dayKey: key });
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}

        <button
          className="more"
          onClick={(e) => {
            e.stopPropagation();
            void loadMoreDays();
          }}
          disabled={loading}
        >
          {loading ? 'Betöltés…' : 'Korábbi napok'}
        </button>
      </div>

      {/* A mindent felsoroló jelmagyarázat helyett csak az számít, amit épp
          kijelöltél — és annak a kezdete/vége az adott napon belül. */}
      <div className="selbar">
        {sel && selAct ? (
          <>
            <span className="chipicon" style={{ background: selAct.color }}>
              <Icon name={selAct.icon} size={15} />
            </span>
            <strong>{selAct.label}</strong>
            <span className="selbar__times">
              {fmtDay(sel.dayKey)} · {fmtTime(sel.start)}–{fmtTime(sel.end)}
            </span>
            <b>{fmtDuration(sel.end - sel.start)}</b>
          </>
        ) : (
          <span className="selbar__hint">Koppints egy sávra</span>
        )}
      </div>
    </div>
  );
}
