import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import brandConfig from '../../brandConfig';

const FeedbackContext = createContext(null);
let nextToastId = 1;

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmation, setConfirmation] = useState(null);
  const confirmResolver = useRef(null);

  const dismiss = useCallback((id) => setToasts((items) => items.filter((item) => item.id !== id)), []);
  const notify = useCallback((message, variant = 'info') => {
    const id = nextToastId++;
    setToasts((items) => [...items, { id, message: String(message), variant }]);
    window.setTimeout(() => dismiss(id), 5200);
  }, [dismiss]);
  const confirm = useCallback((message, options = {}) => new Promise((resolve) => {
    if (confirmResolver.current) confirmResolver.current(false);
    confirmResolver.current = resolve;
    setConfirmation({
      message: String(message), title: options.title || 'Confirmar acción',
      confirmLabel: options.confirmLabel || 'Confirmar', cancelLabel: options.cancelLabel || 'Cancelar',
      danger: options.danger ?? true,
    });
  }), []);
  const resolveConfirmation = useCallback((answer) => {
    confirmResolver.current?.(answer);
    confirmResolver.current = null;
    setConfirmation(null);
  }, []);

  useEffect(() => {
    if (!confirmation) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') resolveConfirmation(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmation, resolveConfirmation]);

  const contextValue = { notify, confirm };
  return <FeedbackContext.Provider value={contextValue}>
    {children}
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite" aria-relevant="additions text">
      {toasts.map((toast) => {
        const style = {
          success: { icon: 'check_circle', classes: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
          error: { icon: 'error', classes: 'border-red-200 bg-red-50 text-red-900' },
          warning: { icon: 'warning', classes: 'border-amber-200 bg-amber-50 text-amber-950' },
          info: { icon: 'info', classes: 'border-stone-200 bg-white text-stone-800' },
        }[toast.variant] || { icon: 'info', classes: 'border-stone-200 bg-white text-stone-800' };
        return <div key={toast.id} role={toast.variant === 'error' ? 'alert' : 'status'} className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-lg ${style.classes}`}>
          <span className="material-symbols-outlined mt-0.5 text-[20px]">{style.icon}</span>
          <p className="min-w-0 flex-1 text-sm font-medium leading-5">{toast.message}</p>
          <button type="button" onClick={() => dismiss(toast.id)} aria-label="Cerrar notificación" className="-mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg hover:bg-black/5"><span className="material-symbols-outlined text-base">close</span></button>
        </div>;
      })}
    </div>
    {confirmation && <div className="fixed inset-0 z-[110] grid place-items-center bg-black/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) resolveConfirmation(false); }}>
      <section role="alertdialog" aria-modal="true" aria-labelledby="feedback-confirm-title" aria-describedby="feedback-confirm-message" className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3"><span className={`material-symbols-outlined grid h-11 w-11 shrink-0 place-items-center rounded-xl ${confirmation.danger ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>{confirmation.danger ? 'warning' : 'help'}</span><div><h2 id="feedback-confirm-title" className="text-lg font-semibold text-stone-900">{confirmation.title}</h2><p id="feedback-confirm-message" className="mt-2 whitespace-pre-line text-sm leading-6 text-stone-600">{confirmation.message}</p></div></div>
        <div className="mt-6 flex justify-end gap-2"><button type="button" autoFocus onClick={() => resolveConfirmation(false)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50">{confirmation.cancelLabel}</button><button type="button" onClick={() => resolveConfirmation(true)} className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${confirmation.danger ? 'bg-red-700 hover:bg-red-800' : 'bg-primary hover:brightness-95'}`}>{confirmation.confirmLabel}</button></div>
      </section>
    </div>}
  </FeedbackContext.Provider>;
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error('useFeedback debe usarse dentro de FeedbackProvider.');
  return context;
}

export function SplashScreen({ message = 'Cargando...', compact = false }) {
  return <div role="status" aria-live="polite" className={`flex w-full items-center justify-center ${compact ? 'min-h-40 p-6' : 'min-h-[45vh] p-8'}`}>
    <div className="flex flex-col items-center gap-3 text-center">
      <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl border border-stone-200 bg-white p-2 shadow-sm"><img src={brandConfig.logo.main} alt="" className="h-full w-full object-contain" /></span>
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-stone-200 border-t-primary" aria-hidden="true" />
      <p className="text-sm font-medium text-on-surface-variant">{message}</p>
    </div>
  </div>;
}
