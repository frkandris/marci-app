import { useRef, useState } from 'react';
import { useStore } from '../App';
import {
  archiveActivity,
  deleteActivityHard,
  reorderActivities,
  saveActivity,
  unarchiveActivity,
} from '../store';
import { liveActivities, type Activity } from '../model';
import { ICON_NAMES, Icon } from '../icons';

const PRESETS = [
  '#4A56C4', '#8B6FD0', '#C0559B', '#D9634E',
  '#DE8A2C', '#8AA82E', '#3FA36E', '#2A9CBE',
];

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

interface Drag {
  from: number;
  to: number;
  startY: number;
  rowH: number;
}

export function Settings() {
  const { activities } = useStore();
  const live = liveActivities(activities);
  const archived = activities.filter((a) => a.archived).sort((a, b) => a.sort - b.sort);

  const [editing, setEditing] = useState<Activity | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ a: Activity; usage: number } | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Húzás közben a lista már a leendő sorrendben látszik — enélkül vakon húzol.
  const order = drag ? move(live, drag.from, drag.to) : live;

  function move<T>(arr: T[], from: number, to: number): T[] {
    const out = [...arr];
    out.splice(to, 0, ...out.splice(from, 1));
    return out;
  }

  function onGripDown(e: React.PointerEvent, index: number) {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const rows = listRef.current?.children;
    const rowH = rows?.[0] ? (rows[0] as HTMLElement).offsetHeight : 56;
    setDrag({ from: index, to: index, startY: e.clientY, rowH });
  }

  function onGripMove(e: React.PointerEvent) {
    if (!drag) return;
    const shift = Math.round((e.clientY - drag.startY) / drag.rowH);
    const to = Math.min(Math.max(drag.from + shift, 0), live.length - 1);
    if (to !== drag.to) setDrag({ ...drag, to });
  }

  function onGripUp() {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (d.from !== d.to) {
      void reorderActivities([...move(live, d.from, d.to), ...archived].map((a) => a.id));
    }
  }

  function startNew() {
    setIsNew(true);
    setEditing({
      id: '',
      label: '',
      color: PRESETS[(live.length * 3) % PRESETS.length],
      icon: 'star',
      sort: (live.at(-1)?.sort ?? 0) + 10,
      archived: false,
    });
  }

  async function save() {
    if (!editing) return;
    const id = isNew ? slug(editing.label) || `t${Date.now().toString(36)}` : editing.id;
    await saveActivity({ ...editing, id, label: editing.label.trim() || id });
    setEditing(null);
    setIsNew(false);
  }

  async function tryDelete(a: Activity) {
    const usage = await deleteActivityHard(a.id, false);
    if (usage !== null) setConfirmDelete({ a, usage });
    else setEditing(null);
  }

  return (
    <div className="settings">
      <ul className="actlist" ref={listRef}>
        {order.map((a) => {
          const i = live.indexOf(a);
          const dragging = drag && live[drag.from].id === a.id;
          return (
            <li key={a.id} className={dragging ? 'is-dragging' : ''}>
              <span
                className="grip"
                onPointerDown={(e) => onGripDown(e, i)}
                onPointerMove={onGripMove}
                onPointerUp={onGripUp}
                onPointerCancel={() => setDrag(null)}
                role="button"
                tabIndex={0}
                aria-label={`${a.label} áthelyezése`}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <circle cx="6" cy="3" r="1.4" /><circle cx="10" cy="3" r="1.4" />
                  <circle cx="6" cy="8" r="1.4" /><circle cx="10" cy="8" r="1.4" />
                  <circle cx="6" cy="13" r="1.4" /><circle cx="10" cy="13" r="1.4" />
                </svg>
              </span>
              <button className="actlist__main" onClick={() => (setIsNew(false), setEditing(a))}>
                <span className="chipicon" style={{ background: a.color }}>
                  <Icon name={a.icon} size={17} />
                </span>
                <span className="actlist__text">
                  <span className="actlist__name">{a.label}</span>
                  <span className="actlist__meta">{a.usageCount ?? 0} esemény</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <button className="wide" onClick={startNew}>
        Új tevékenység
      </button>

      {archived.length > 0 && (
        <>
          <h2 className="eyebrow sect">Archivált</h2>
          <ul className="actlist actlist--muted">
            {archived.map((a) => (
              <li key={a.id}>
                <span className="grip grip--off" aria-hidden="true" />
                <span className="actlist__main">
                  <span className="chipicon" style={{ background: a.color }}>
                    <Icon name={a.icon} size={17} />
                  </span>
                  <span className="actlist__text">
                    <span className="actlist__name">{a.label}</span>
                    <span className="actlist__meta">{a.usageCount ?? 0} esemény</span>
                  </span>
                </span>
                <button className="link" onClick={() => void unarchiveActivity(a)}>
                  Vissza
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {editing && (
        <div className="sheet-backdrop" onClick={() => setEditing(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="preview" style={{ '--c': editing.color } as React.CSSProperties}>
              <span className="chipicon chipicon--lg" style={{ background: editing.color }}>
                <Icon name={editing.icon} size={22} />
              </span>
              {editing.label || 'Név'}
            </div>

            <input
              className="bigfield"
              value={editing.label}
              onChange={(e) => setEditing({ ...editing, label: e.target.value })}
              placeholder="Név"
              autoFocus={isNew}
            />

            <div className="picker">
              {ICON_NAMES.map((n) => (
                <button
                  key={n}
                  className={`pickbtn ${editing.icon === n ? 'is-active' : ''}`}
                  onClick={() => setEditing({ ...editing, icon: n })}
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
                  className={`pickbtn pickbtn--color ${editing.color.toUpperCase() === c ? 'is-active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setEditing({ ...editing, color: c })}
                  aria-label={`Szín ${c}`}
                />
              ))}
              <input
                type="color"
                className="pickbtn pickbtn--color pickbtn--custom"
                value={editing.color}
                onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                aria-label="Egyéni szín"
              />
            </div>

            <div className="sheet__actions">
              <button className="primary" onClick={() => void save()} disabled={!editing.label.trim()}>
                Mentés
              </button>
              <button onClick={() => setEditing(null)}>Mégse</button>
            </div>

            {!isNew && (
              <div className="danger-zone">
                <button onClick={() => void archiveActivity(editing.id).then(() => setEditing(null))}>
                  Archiválás
                </button>
                <button className="danger" onClick={() => void tryDelete(editing)}>
                  Végleges törlés
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="sheet-backdrop" onClick={() => setConfirmDelete(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>
              {confirmDelete.usage} esemény is törlődik vele. Nem vonható vissza.
            </h3>
            <div className="sheet__actions">
              <button
                onClick={() => {
                  void archiveActivity(confirmDelete.a.id);
                  setConfirmDelete(null);
                  setEditing(null);
                }}
              >
                Inkább archiválom
              </button>
              <button
                className="danger"
                onClick={() => {
                  void deleteActivityHard(confirmDelete.a.id, true);
                  setConfirmDelete(null);
                  setEditing(null);
                }}
              >
                Törlés
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
