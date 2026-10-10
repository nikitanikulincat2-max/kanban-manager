import ReactDOM from 'react-dom/client';
import { ToastContainer } from 'react-toastify';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-toastify/dist/ReactToastify.css';
import './index.css';

registerSW({
  immediate: true,
  onNeedRefresh() {
    if (confirm('Доступно обновление. Перезагрузить?')) {
      window.location.reload();
    }
  },
  onOfflineReady() {
    console.log('Приложение готово к офлайн-работе');
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <>
    <App />
    <ToastContainer
      position="top-right"
      autoClose={3000}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme="light"
    />
  </>
);