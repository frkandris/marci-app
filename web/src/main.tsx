import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import './styles.css';

// A telepített PWA a régi bundle-t futtatja, amíg a service worker le nem
// cseréli magát. Enélkül a telefonok napokig a régi kódot futtathatnák.
// Lásd wiki/integrations/ios-safari-pwa.md → 6. csapda.
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('Új verzió érhető el. Újratöltöd?')) void updateSW(true);
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
