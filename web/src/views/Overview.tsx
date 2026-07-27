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
  liveActivities,
  segmentsFor,
  shiftDayKey,
} from '../model';

export function Overview({ onOpenDay }: { onOpenDay: (key: string) => void }) {
  const { markers, activities, daysLoaded, loading } = useStore();
  const [peek, setPeek] = useState<{ label: string; text: string } | null>(null);

  const live = liveActivities(activities);
  // A byId a TELJES listából épül, hogy az archivált típusok régi szegmensei
  // is nevet és színt kapjanak.
  const byId = useMemo(() => new Map(activities.map((a) => [a.id, a])), [activities]);
  const now = Date.now();

  const days = useMemo(() => {
    const today = dayKey(now, DAY_START_HOUR);
    return Array.from({ length: daysLoaded }, (_, i) => shiftDayKey(today, -i));
  }, [daysLoaded, now]);

  return (
    <div className="overview">
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
              <button className="row__label" onClick={() => onOpenDay(key)}>
                {fmtDay(key)}
              </button>
              <div className="row__track">
                {segs.map((s) => {
                  const a = byId.get(s.activityId);
                  return (
                    <button
                      key={s.markerId}
                      className="row__seg"
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
                        setPeek({
                          label: a?.label ?? s.activityId,
                          text: `${fmtTime(s.start)}–${fmtTime(s.end)} · ${fmtDuration(s.end - s.start)}`,
                        });
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}

        <button className="more" onClick={() => void loadMoreDays()} disabled={loading}>
          {loading ? 'Betöltés…' : 'Korábbi napok'}
        </button>
      </div>

      <div className="legend">
        {live.map((a) => (
          <span key={a.id}>
            <i style={{ background: a.color }} />
            {a.label}
          </span>
        ))}
      </div>

      {peek && (
        <div className="toast toast--peek" onClick={() => setPeek(null)}>
          <strong>{peek.label}</strong> {peek.text}
        </div>
      )}
    </div>
  );
}
