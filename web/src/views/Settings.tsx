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
  deleteActivityHard,
  saveActivity,
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

export function Settings() {
  const { activities } = useStore();
  const live = liveActivities(activities);

  const [editing, setEditing] = useState<Activity | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ a: Activity; usage: number } | null>(null);

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

  const chip = (a: Activity, size = 17) => (
    <span className="chipicon" style={{ background: a.color }}>
      <Icon name={a.icon} size={size} />
    </span>
  );

  return (
    <div className="settings">
      <List strongIos insetIos className="marci-list">
        {live.map((a) => (
          <ListItem
            key={a.id}
            media={chip(a)}
            title={a.label}
            subtitle={`${a.usageCount ?? 0} esemény`}
            link
            onClick={() => (setIsNew(false), setEditing(a))}
          />
        ))}
      </List>

      <Block className="!mt-2">
        <Button rounded outline onClick={startNew}>
          Új tevékenység
        </Button>
      </Block>


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
                <Button
                  rounded
                  outline
                  colors={{ textIos: 'text-red-500', outlineBorderIos: 'border-red-500' }}
                  onClick={() => void tryDelete(editing)}
                >
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
            bold
            colors={{ textIos: 'text-red-500' }}
            onClick={() => {
              if (confirmDelete) void deleteActivityHard(confirmDelete.a.id, true);
              setConfirmDelete(null);
              setEditing(null);
            }}
          >
            Törlés {confirmDelete?.usage} eseménnyel
          </ActionsButton>
        </ActionsGroup>
        <ActionsGroup>
          <ActionsButton onClick={() => setConfirmDelete(null)}>Mégse</ActionsButton>
        </ActionsGroup>
      </Actions>
    </div>
  );
}
