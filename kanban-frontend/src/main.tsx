import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { ConfirmProvider } from './contexts/ConfirmContext';
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

registerSW({
  immediate: true,
  onNeedRefresh() {
    window.location.reload();
  },
  onOfflineReady() {
    console.log('Приложение готово к офлайн-работе');
  },
});

if ('serviceWorker' in navigator) {
  setInterval(
    () => {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((reg) => reg.update());
      });
    },
    30 * 60 * 1000
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ConfirmProvider>
    <App />
    <>
  <ToastContainer position="top-right" autoClose={3000} />
</>
  </ConfirmProvider>
);