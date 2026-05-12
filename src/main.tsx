import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Service Worker ready check
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready
    .then((registration) => {
      console.log('[SW] Service Worker ready:', registration.scope);
    })
    .catch((error) => {
      console.error('[SW] Service Worker ready failed:', error);
    });
}
