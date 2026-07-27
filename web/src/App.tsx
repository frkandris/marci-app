import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { App as KonstaApp, Tabbar, TabbarLink } from 'konsta/react';
import { applyUpdate, getState, init, setToken, subscribe } from './store';
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
  { key: 'settings', label: 'Beállítások', icon: 'gear' },
] as const;

export function App() {
  const s = useStore();
  const [tab, setTab] = useState<Tab>('capture');
  const [day, setDay] = useState(() => dayKey(Date.now()));
  // Követi-e a kiválasztott nap a "mait"? A telefonon a PWA napokig nyitva
  // marad, és 04:00-kor a "ma" mást jelent — de ha a felhasználó SZÁNDÉKOSAN
  // nyitott meg egy múltbeli napot, arról nem rántjuk el.
  const followsToday = useRef(true);

  useEffect(() => init(), []);

  useEffect(() => {
    const sync = () => {
      if (followsToday.current) setDay(dayKey(Date.now()));
    };
    // Előtérbe kerüléskor azonnal: háttérben az időzítők lelassulnak, és épp
    // reggel, az első ránézéskor számít a legtöbbet. A percenkénti ellenőrzés
    // arra kell, hogy a nyitva hagyott app is átforduljon 04:00-kor.
    document.addEventListener('visibilitychange', sync);
    const t = setInterval(sync, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      clearInterval(t);
    };
  }, []);

  const chooseDay = (key: string) => {
    followsToday.current = key === dayKey(Date.now());
    setDay(key);
  };

  const openDay = (key: string) => {
    chooseDay(key);
    setTab('day');
  };

  if (!s.ready) return <div className="boot">Betöltés…</div>;

  // Csak akkor jelenik meg, ha a szerveren be van kapcsolva a SHARED_TOKEN.
  if (s.needsToken) {
    return (
      <KonstaApp theme="ios" safeAreas={false} className="marci-root">
        <form
          className="gate"
          onSubmit={(e) => {
            e.preventDefault();
            setToken(new FormData(e.currentTarget).get('t') as string);
          }}
        >
          <h2 className="eyebrow">Jelszó</h2>
          <input className="bigfield" name="t" type="password" autoFocus />
          <button className="wide" type="submit">
            Belépés
          </button>
        </form>
      </KonstaApp>
    );
  }

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
          {tab === 'day' && <Day dayKey={day} setDayKey={chooseDay} />}
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
