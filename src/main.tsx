import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        registration.update().catch(() => {});
      }
    },
    onRegisterError(error) {
      console.warn('[PWA] Service Worker registration skipped:', error);
    },
  });
}

createRoot(document.getElementById('root')!).render(<App />);
