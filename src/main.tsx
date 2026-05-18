import { StrictMode } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { ToastProvider } from './hooks/useToast'

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');
createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
)

// Service Worker ready check
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready
    .then((registration) => {
      console.log('[SW] Service Worker ready:', registration.scope);
    })
    .catch((error: unknown) => {
      console.error('[SW] Service Worker ready failed:', error);
    });
}
