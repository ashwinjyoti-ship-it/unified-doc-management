import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';
import 'tippy.js/dist/tippy.css';

registerSW({
  immediate: true,
  onNeedRefresh() {
    if (window.confirm('A new version is available. Reload to update?')) {
      window.location.reload();
    }
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
