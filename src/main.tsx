import '@fontsource/andika/latin-400.css';
import '@fontsource/andika/latin-700.css';
import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';
import { AppProviders } from './app/AppProviders';
import { AppRoutes } from './app/AppRoutes';
import { createBrowserServices, unlockAudioOnFirstGesture } from './app/browserServices';
import { guardDoubleTaps } from './ui/doubleTaps';

const services = createBrowserServices();
unlockAudioOnFirstGesture(window, services);
guardDoubleTaps(document);

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <AppProviders services={services}>
      {/* Hash routing works from any static host or folder with no server config. */}
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AppProviders>
  </StrictMode>,
);
