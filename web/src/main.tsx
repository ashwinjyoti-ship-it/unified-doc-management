import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { applyHostMode } from './lib/host';
import './index.css';
import 'tippy.js/dist/tippy.css';

// Apply the host theme before the first paint so an embedded Tandem never
// flashes its standalone palette.
applyHostMode();

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
