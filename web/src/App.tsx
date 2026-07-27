import { useEffect, useState, useSyncExternalStore } from 'react';
import { getState, init, refresh, subscribe } from './store';
import { Capture } from './views/Capture';
import { Day } from './views/Day';
import { Overview } from './views/Overview';
import { Settings } from './views/Settings';
import { dayKey } from './model';

export type Tab = 'capture' | 'day' | 'overview' | 'settings';

export const useStore = () => useSyncExternalStore(subscribe, getState);

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
    <div className="app">
      <header className="topbar">
        <h1>Marci</h1>
        <button
          className={`status status--${s.error ? 'error' : s.loading ? 'busy' : 'ok'}`}
          onClick={() => void refresh()}
          title={s.error ?? 'Frissítés'}
          aria-label="Frissítés"
        >
          <span className="dot" />
        </button>
      </header>

      {s.error && <div className="banner banner--error">{s.error}</div>}

      <main className="main">
        {tab === 'capture' && <Capture onOpenDay={openDay} />}
        {tab === 'day' && <Day dayKey={day} setDayKey={setDay} />}
        {tab === 'overview' && <Overview onOpenDay={openDay} />}
        {tab === 'settings' && <Settings />}
      </main>

      <nav className="tabs">
        {(
          [
            ['capture', 'Most', '⏺'],
            ['day', 'Nap', '📋'],
            ['overview', 'Napok', '▦'],
            ['settings', 'Típusok', '⚙'],
          ] as const
        ).map(([key, label, icon]) => (
          <button
            key={key}
            className={`tab ${tab === key ? 'is-active' : ''}`}
            onClick={() => setTab(key)}
            aria-current={tab === key ? 'page' : undefined}
          >
            <span aria-hidden="true">{icon}</span>
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
