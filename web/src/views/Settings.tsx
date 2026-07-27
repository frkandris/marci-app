import { useState } from 'react';
import { useStore } from '../App';
import {
  archiveActivity,
  deleteActivityHard,
  reorderActivities,
  saveActivity,
  unarchiveActivity,
} from '../store';
import { liveActivities, type Activity } from '../model';

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

export function Settings() {
  const { activities } = useStore();
  const live = liveActivities(activities);
  const archived = activities.filter((a) => a.archived).sort((a, b) => a.sort - b.sort);

  const [editing, setEditing] = useState<Activity | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ a: Activity; usage: number } | null>(null);

  function startNew() {
    setIsNew(true);
    setEditing({
      id: '',
      label: '',
      color: PRESETS[(live.length * 3) % PRESETS.length],
      icon: '',
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

  function move(i: number, dir: -1 | 1) {
    const next = [...live];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    void reorderActivities([...next, ...archived].map((a) => a.id));
  }

  async function tryDelete(a: Activity) {
    const usage = await deleteActivityHard(a.id, false);
    if (usage !== null) setConfirmDelete({ a, usage });
    else setEditing(null);
  }

  return (
    <div className="settings">
      <div className="sect">
        <h2 className="eyebrow">Tevékenységek</h2>
        <p className="hint">
          A sorrend a Most fülön lévő gombok sorrendje. Csak kézzel változik, hogy a gombok
          mindig ugyanott legyenek.
        </p>
      </div>

      <ul className="actlist">
        {live.map((a, i) => (
          <li key={a.id}>
            <span className="swatch" style={{ background: a.color }} aria-hidden="true" />
            <button className="actlist__main" onClick={() => (setIsNew(false), setEditing(a))}>
              <span className="actlist__name">
                <span aria-hidden="true">{a.icon}</span>
                {a.label}
              </span>
              <span className="actlist__meta">
                {a.usageCount ? `${a.usageCount} esemény` : 'még nincs használatban'}
              </span>
            </button>
            <span className="reorder">
              <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Feljebb">
                ↑
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === live.length - 1}
                aria-label="Lejjebb"
              >
                ↓
              </button>
            </span>
          </li>
        ))}
      </ul>

      <button className="wide" onClick={startNew}>
        Új tevékenység
      </button>

      {archived.length > 0 && (
        <>
          <div className="sect">
            <h2 className="eyebrow">Archivált</h2>
            <p className="hint">
              Nem jelennek meg a gombok között, de a korábbi napokon továbbra is helyesen
              látszanak.
            </p>
          </div>
          <ul className="actlist actlist--muted">
            {archived.map((a) => (
              <li key={a.id}>
                <span className="swatch" style={{ background: a.color }} aria-hidden="true" />
                <span className="actlist__main">
                  <span className="actlist__name">
                    <span aria-hidden="true">{a.icon}</span>
                    {a.label}
                  </span>
                  <span className="actlist__meta">
                    {a.usageCount ? `${a.usageCount} esemény` : 'nincs használatban'}
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
            <h3>{isNew ? 'Új tevékenység' : editing.label}</h3>

            <div className="preview" style={{ '--c': editing.color } as React.CSSProperties}>
              <span className="preview__icon">{editing.icon || '•'}</span>
              {editing.label || 'Név'}
            </div>

            <label className="field">
              <span className="eyebrow">Név</span>
              <input
                value={editing.label}
                onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                placeholder="pl. Uzsonna"
                autoFocus={isNew}
              />
            </label>

            <label className="field">
              <span className="eyebrow">Ikon</span>
              <input
                value={editing.icon ?? ''}
                onChange={(e) => setEditing({ ...editing, icon: e.target.value })}
                placeholder="egy emoji"
                maxLength={4}
              />
            </label>

            <div className="field">
              <span className="eyebrow">Szín</span>
              <div className="swatches">
                {PRESETS.map((c) => (
                  <button
                    key={c}
                    className={`swatchbtn ${editing.color.toUpperCase() === c ? 'is-active' : ''}`}
                    style={{ background: c }}
                    onClick={() => setEditing({ ...editing, color: c })}
                    aria-label={`Szín ${c}`}
                  />
                ))}
                <input
                  type="color"
                  className="swatchbtn swatchbtn--custom"
                  value={editing.color}
                  onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                  aria-label="Egyéni szín"
                />
              </div>
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
                <p className="hint">
                  Az archiválás csak elrejti a gombot. A végleges törlés csak akkor megy át
                  magától, ha egyetlen esemény sem használja.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="sheet-backdrop" onClick={() => setConfirmDelete(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>„{confirmDelete.a.label}" használatban van</h3>
            <p>
              <strong>{confirmDelete.usage} esemény</strong> hivatkozik rá. Ha véglegesen törlöd,
              ezek az események is <strong>eltűnnek</strong> a korábbi napokról. Ez nem vonható
              vissza.
            </p>
            <p className="hint">
              Ha csak a gombot akarod eltüntetni, válaszd az archiválást — a régi napok érintetlenek
              maradnak.
            </p>
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
                Törlés {confirmDelete.usage} eseménnyel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
