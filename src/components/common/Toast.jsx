import { useState, useEffect, useCallback } from 'react';
import { setToastHandler } from './toastEmitter';

let toastId = 0;

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.map((t) => t.id === id ? { ...t, leaving: true } : t));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  const addToast = useCallback(({ type, message, duration = 4000 }) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, type, message, leaving: false }]);
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
  }, [removeToast]);

  useEffect(() => {
    setToastHandler(addToast);
    return () => { setToastHandler(null); };
  }, [addToast]);

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast-${t.type} ${t.leaving ? 'toast-leave' : ''}`}
        >
          <span className="toast-icon">{icons[t.type]}</span>
          <span className="toast-message">{t.message}</span>
          <button className="toast-dismiss" onClick={() => removeToast(t.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}

export default ToastContainer;
