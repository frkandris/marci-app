import { useEffect, useState, useSyncExternalStore } from 'react';
import { App as KonstaApp, Tabbar, TabbarLink } from 'konsta/react';
import { applyUpdate, getState, init, subscribe } from './store';
import { Capture } from './views/Capture';
import { Day } from './views/Day';
import { Overview } from './views/Overview';
import { Settings } from './views/Settings';
import { dayKey } from './model';
import { Icon } from './icons';

export type Tab = 'capture' | 'day' | 'overview' | 'settings';

export const useStore = () => useSyncExternalStore(subscribe, getState);

const TABS = [
  { key: 'capture', label: 'Most', icon: 'record' },
  { key: 'day', label: 'Nap', icon: 'list' },
  { key: 'overview', label: 'Napok', icon: 'grid' },
  { key: 'settings', label: 'Típusok', icon: 'sliders' },
] as const;

export function App() {
  const s = useStore();
  const [tab, setTab] = useState<Tab>('capture');
  const [day, setDay] = useState(() => dayKey(Date.now()));

  useEffect(() => init(), []);

  const openDay = (key: string) => {
    setDay(key);
    setTab('day');
  };

  if (!s.ready) return <div className="boot">Betöltés…</div>;

  return (
    // A Konsta iOS témája adja a natív érzetű tipográfiát, az érintés-
    // visszajelzést, a hairline-okat és a biztonságos zónákat. A bespoke
    // részek (napsáv, idővonal, gombrács) saját CSS-t tartanak.
    <KonstaApp theme="ios" safeAreas={false} className="marci-root">
      <div className="app">
        {s.error && <div className="banner banner--error">{s.error}</div>}

        {s.updateReady && (
          <div className="banner banner--update">
            <span>Új verzió érhető el.</span>
            <button onClick={applyUpdate}>Frissítés</button>
          </div>
        )}

        <main className="main">
          {tab === 'capture' && <Capture onOpenDay={openDay} />}
          {tab === 'day' && <Day dayKey={day} setDayKey={setDay} />}
          {tab === 'overview' && <Overview onOpenDay={openDay} />}
          {tab === 'settings' && <Settings />}
        </main>

        <Tabbar labels icons className="marci-tabbar">
          {TABS.map((t) => (
            <TabbarLink
              key={t.key}
              active={tab === t.key}
              onClick={() => setTab(t.key)}
              icon={<Icon name={t.icon} size={22} />}
              label={t.label}
            />
          ))}
        </Tabbar>
      </div>
    </KonstaApp>
  );
}
