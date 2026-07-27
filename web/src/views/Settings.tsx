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
  createActivity,
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

type Section = 'activities';

export function Settings() {
  const { activities } = useStore();
  // Almenü-szerkezet: a gyökér csak a szakaszokat listázza, hogy később
  // továbbiak is elférjenek anélkül, hogy a tevékenységlista elnyomná őket.
  const [section, setSection] = useState<Section | null>(null);
  // A Beállításokban ÁBÉCÉ szerint, hogy bármit gyorsan meg lehessen találni.
  // (A gyorsrögzítő gombok sorrendje ettől független: ott a használat dönt.)
  const live = liveActivities(activities).sort((a, b) => a.label.localeCompare(b.label, 'hu'));

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
      // A `live` ÁBÉCÉ szerint van rendezve, nem `sort` szerint — a legnagyobb
      // kézi sort-ból számolunk, különben ütköző értéket kapna.
      sort: Math.max(0, ...live.map((a) => a.sort)) + 10,
      archived: false,
    });
  }

  async function save() {
    if (!editing) return;
    const label = editing.label.trim();
    const row = isNew
      ? await createActivity({ label, color: editing.color, icon: editing.icon, sort: editing.sort })
      : await saveActivity({ ...editing, label });
    // Hibánál nyitva marad, hogy a beírt adatok ne vesszenek el.
    if (!row) return;
    setEditing(null);
    setIsNew(false);
  }

  async function tryDelete(a: Activity) {
    const res = await deleteActivityHard(a.id, false);
    if (res === 'deleted') setEditing(null);
    else if (typeof res === 'number') setConfirmDelete({ a, usage: res });
    // 'error' esetén nyitva marad, a hibasáv jelzi a bajt.
  }

  const chip = (a: Activity, size = 17) => (
    <span className="chipicon" style={{ background: a.color }}>
      <Icon name={a.icon} size={size} />
    </span>
  );

  if (section === null) {
    return (
      <div className="settings">
        <List strongIos insetIos className="marci-list">
          <ListItem
            title="Tevékenységek"
            after={`${live.length}`}
            link
            onClick={() => setSection('activities')}
          />
        </List>
      </div>
    );
  }

  return (
    <div className="settings">
      <button className="subnav" onClick={() => setSection(null)}>
        ‹ Beállítások
      </button>

      <List strongIos insetIos className="marci-list">
        {live.map((a) => (
          <ListItem
            key={a.id}
            media={chip(a)}
            title={a.label}
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
              <Button rounded tonal onClick={() => setEditing(null)}>
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
            {confirmDelete?.usage} esemény sávja üresre vált. Nem vonható vissza.
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
            Törlés
          </ActionsButton>
        </ActionsGroup>
        <ActionsGroup>
          <ActionsButton onClick={() => setConfirmDelete(null)}>Mégse</ActionsButton>
        </ActionsGroup>
      </Actions>
    </div>
  );
}
