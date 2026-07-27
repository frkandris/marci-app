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
const updateSW = registerSW({
  onNeedRefresh() {
    setUpdateAvailable(() => void updateSW(true));
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
