let addToastFn = null;

export const setToastHandler = (fn) => {
  addToastFn = fn;
};

/** Call this anywhere: toast.success('Done!'), toast.error('Failed') */
export const toast = {
  success: (message, duration) => addToastFn?.({ type: 'success', message, duration }),
  error: (message, duration) => addToastFn?.({ type: 'error', message, duration }),
  warning: (message, duration) => addToastFn?.({ type: 'warning', message, duration }),
  info: (message, duration) => addToastFn?.({ type: 'info', message, duration }),
};

export default toast;
