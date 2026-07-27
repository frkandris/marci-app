import { useState } from 'react';
import { useStore } from '../App';
import { archiveActivity, saveActivity } from '../store';
import { liveActivities, type Activity } from '../model';

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function Settings() {
  const { activities, daysLoaded } = useStore();
  const live = liveActivities(activities);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [isNew, setIsNew] = useState(false);

  function startNew() {
    setIsNew(true);
    setEditing({
      id: '',
      label: '',
      color: '#3FA36E',
      icon: '⭐',
      sort: (live.at(-1)?.sort ?? 0) + 10,
      archived: false,
    });
  }

  async function save() {
    if (!editing) return;
    const id = isNew ? slug(editing.label) || crypto.randomUUID().slice(0, 8) : editing.id;
    await saveActivity({ ...editing, id, label: editing.label.trim() || id });
    setEditing(null);
    setIsNew(false);
  }

  return (
    <div className="settings">
      <h2>Tevékenységtípusok</h2>
      <p className="hint">
        A sorrend a „Most" fülön lévő gombok sorrendje. Szándékosan csak kézzel változik — az
        izommemória többet ér, mint az optimalizált sorrend.
      </p>

      <ul className="actlist">
        {live.map((a) => (
          <li key={a.id}>
            <span className="swatch" style={{ background: a.color }} />
            <span className="actlist__label">
              {a.icon} {a.label}
            </span>
            <button
              className="link"
              onClick={() => {
                setIsNew(false);
                setEditing(a);
              }}
            >
              Szerkesztés
            </button>
          </li>
        ))}
      </ul>

      <button className="wide" onClick={startNew}>
        + Új típus
      </button>

      <h2>Állapot</h2>
      <dl className="meta">
        <dt>Betöltött napok</dt>
        <dd>{daysLoaded}</dd>
        <dt>Aktív típusok</dt>
        <dd>{live.length}</dd>
        <dt>Archivált</dt>
        <dd>{activities.length - live.length}</dd>
      </dl>

      {editing && (
        <div className="sheet-backdrop" onClick={() => setEditing(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>{isNew ? 'Új típus' : editing.label}</h3>
            <label>
              Név
              <input
                value={editing.label}
                onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                placeholder="pl. Uzsonna"
              />
            </label>
            <label>
              Ikon
              <input
                value={editing.icon ?? ''}
                onChange={(e) => setEditing({ ...editing, icon: e.target.value })}
                maxLength={4}
              />
            </label>
            <label>
              Szín
              <input
                type="color"
                value={editing.color}
                onChange={(e) => setEditing({ ...editing, color: e.target.value })}
              />
            </label>
            <label>
              Sorrend
              <input
                type="number"
                value={editing.sort}
                onChange={(e) => setEditing({ ...editing, sort: Number(e.target.value) })}
              />
            </label>
            <div className="sheet__actions">
              {!isNew && (
                <button
                  className="danger"
                  onClick={() => {
                    void archiveActivity(editing.id);
                    setEditing(null);
                  }}
                >
                  Archiválás
                </button>
              )}
              <button onClick={() => setEditing(null)}>Mégse</button>
              <button
                className="primary"
                onClick={() => void save()}
                disabled={!editing.label.trim()}
              >
                Mentés
              </button>
            </div>
            {!isNew && (
              <p className="hint">
                Az archivált típus eltűnik a gombok közül, de a korábbi napok szegmensei
                továbbra is helyesen jelennek meg.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
