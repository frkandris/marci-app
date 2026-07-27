import { useState } from 'react';
import {
  Actions,
  ActionsButton,
  ActionsGroup,
  ActionsLabel,
  Block,
  Button,
  List,
  ListItem,
  Sheet,
} from 'konsta/react';
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

// A tevékenységekhez választható ikonok — a négy fülikon nem tartozik ide.
const PICKABLE = ICON_NAMES.filter((n) => !['record', 'list', 'grid', 'sliders'].includes(n));

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * Ütközésmentes azonosító. Enélkül egy második „Séta" (vagy egy ékezet nélküli
 * „Seta") ugyanarra a slugra képződne, és az upsert NÉMÁN felülírná a meglévő
 * tevékenységet — az összes régi markere új nevet és színt kapna.
 */
export function uniqueId(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

interface Drag {
  from: number;
  to: number;
  startY: number;
  rowH: number;
}

const move = <T,>(arr: T[], from: number, to: number): T[] => {
  const out = [...arr];
  out.splice(to, 0, ...out.splice(from, 1));
  return out;
};

export function Settings() {
  const { activities } = useStore();
  const live = liveActivities(activities);
  const archived = activities.filter((a) => a.archived).sort((a, b) => a.sort - b.sort);

  const [editing, setEditing] = useState<Activity | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ a: Activity; usage: number } | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  // Húzás közben a lista már a leendő sorrendben látszik — enélkül vakon húzol.
  const order = drag ? move(live, drag.from, drag.to) : live;

  function onGripDown(e: React.PointerEvent, index: number) {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* nem kritikus */
    }
    // A sormagasságot a saját sorából olvassuk, nem a lista gyerekeiből: a
    // Konsta List belső szerkezete nem garantált.
    const rowH = el.closest('li')?.offsetHeight ?? 56;
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
    const id = isNew
      ? uniqueId(slug(editing.label) || 't', new Set(activities.map((a) => a.id)))
      : editing.id;
    await saveActivity({ ...editing, id, label: editing.label.trim() || id });
    setEditing(null);
    setIsNew(false);
  }

  async function tryDelete(a: Activity) {
    const usage = await deleteActivityHard(a.id, false);
    if (usage !== null) setConfirmDelete({ a, usage });
    else setEditing(null);
  }

  const grip = (index: number) => (
    <span
      className="grip"
      onPointerDown={(e) => onGripDown(e, index)}
      onPointerMove={onGripMove}
      onPointerUp={onGripUp}
      onPointerCancel={() => setDrag(null)}
      onClick={(e) => e.stopPropagation()}
      role="button"
      tabIndex={0}
      aria-label="Áthelyezés"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <circle cx="6" cy="3" r="1.4" /><circle cx="10" cy="3" r="1.4" />
        <circle cx="6" cy="8" r="1.4" /><circle cx="10" cy="8" r="1.4" />
        <circle cx="6" cy="13" r="1.4" /><circle cx="10" cy="13" r="1.4" />
      </svg>
    </span>
  );

  const chip = (a: Activity, size = 17) => (
    <span className="chipicon" style={{ background: a.color }}>
      <Icon name={a.icon} size={size} />
    </span>
  );

  return (
    <div className="settings">
      <List strongIos insetIos className="marci-list">
        {order.map((a) => {
          const i = live.indexOf(a);
          return (
            <ListItem
              key={a.id}
              className={drag && live[drag.from].id === a.id ? 'is-dragging' : ''}
              media={chip(a)}
              title={a.label}
              subtitle={`${a.usageCount ?? 0} esemény`}
              after={grip(i)}
              onClick={() => (setIsNew(false), setEditing(a))}
            />
          );
        })}
      </List>

      <Block className="!mt-2">
        <Button rounded outline onClick={startNew}>
          Új tevékenység
        </Button>
      </Block>

      {archived.length > 0 && (
        <List strongIos insetIos className="marci-list opacity-60">
          {archived.map((a) => (
            <ListItem
              key={a.id}
              media={chip(a)}
              title={a.label}
              subtitle={`${a.usageCount ?? 0} esemény`}
              after={
                <button className="link" onClick={() => void unarchiveActivity(a)}>
                  Vissza
                </button>
              }
            />
          ))}
        </List>
      )}

      <Sheet opened={!!editing} onBackdropClick={() => setEditing(null)} className="marci-sheet">
        {editing && (
          <Block>
            <div className="preview" style={{ '--c': editing.color } as React.CSSProperties}>
              <span className="chipicon chipicon--lg" style={{ background: editing.color }}>
                <Icon name={editing.icon} size={22} />
              </span>
              {editing.label || 'Név'}
            </div>

            <input
              className="bigfield"
              value={editing.label}
              placeholder="Név"
              onChange={(e) => setEditing({ ...editing, label: e.target.value })}
            />

            <div className="picker">
              {PICKABLE.map((n) => (
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

            <div className="sheet__row">
              <Button rounded onClick={() => void save()} disabled={!editing.label.trim()}>
                Mentés
              </Button>
              <Button rounded clear onClick={() => setEditing(null)}>
                Mégse
              </Button>
            </div>

            {!isNew && (
              <div className="sheet__row sheet__row--danger">
                <Button rounded outline onClick={() => void archiveActivity(editing.id).then(() => setEditing(null))}>
                  Archiválás
                </Button>
                <Button rounded outline colors={{ textIos: 'text-red-500', outlineBorderIos: 'border-red-500' }} onClick={() => void tryDelete(editing)}>
                  Törlés
                </Button>
              </div>
            )}
          </Block>
        )}
      </Sheet>

      <Actions opened={!!confirmDelete} onBackdropClick={() => setConfirmDelete(null)}>
        <ActionsGroup>
          <ActionsLabel>
            {confirmDelete?.usage} esemény is törlődik vele. Nem vonható vissza.
          </ActionsLabel>
          <ActionsButton
            onClick={() => {
              if (confirmDelete) void archiveActivity(confirmDelete.a.id);
              setConfirmDelete(null);
              setEditing(null);
            }}
          >
            Inkább archiválom
          </ActionsButton>
          <ActionsButton
            bold
            colors={{ textIos: 'text-red-500' }}
            onClick={() => {
              if (confirmDelete) void deleteActivityHard(confirmDelete.a.id, true);
              setConfirmDelete(null);
              setEditing(null);
            }}
          >
            Végleges törlés
          </ActionsButton>
        </ActionsGroup>
        <ActionsGroup>
          <ActionsButton onClick={() => setConfirmDelete(null)}>Mégse</ActionsButton>
        </ActionsGroup>
      </Actions>
    </div>
  );
}
