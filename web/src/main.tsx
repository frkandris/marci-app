import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { setUpdateAvailable } from './store';
import './styles.css';

// A telepített PWA a régi bundle-t futtatja, amíg a service worker le nem
// cseréli magát — ezért kell explicit frissítési jelzés.
//
// SOHA nem `confirm()`: a natív dialógus BLOKKOLJA a renderert, amíg nyitva van
// (minden esemény, időzítő és rajzolás megáll). Helyette az app saját sávja
// kínálja fel a frissítést.
/** Milyen sűrűn nézzük, van-e új verzió, amíg az app nyitva van. */
const UPDATE_CHECK_MS = 15 * 60_000;

const updateSW = registerSW({
  onNeedRefresh() {
    setUpdateAvailable(() => void updateSW(true));
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    // A böngésző alapból csak navigációkor néz rá a service workerre, ezért
    // egy nyitva hagyott app napokig futtathatná a régi kódot. Előtérbe
    // kerüléskor MINDIG, és nyitva tartás közben negyedóránként rákérdezünk.
    const check = () => void registration.update().catch(() => {});
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      timer ??= setInterval(check, UPDATE_CHECK_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        check();
        start();
      } else {
        stop();
      }
    });
    window.addEventListener('online', check);
    if (document.visibilityState === 'visible') start();
  },
});

// A Konsta a `.dark` OSZTÁLYRA szűr (@custom-variant dark), nem a
// prefers-color-scheme médiaszabályra. Ezért kézzel tartjuk szinkronban a
// rendszerbeállítással — élőben is, ha a felhasználó menet közben vált.
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
const applyTheme = () => document.documentElement.classList.toggle('dark', darkQuery.matches);
applyTheme();
darkQuery.addEventListener('change', applyTheme);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
