import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from 'react';
import { Toast } from '../components/Toast';
import { ToastContext, type ToastItem, type ToastType } from './useToast';

const TOAST_DURATION = {
  success: 4000,
  error: 6000,
  info: 4000,
  warning: 4000,
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }
  }, []);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = `toast-${String(Date.now())}-${Math.random().toString(36).slice(2, 9)}`;
    const newToast: ToastItem = { id, message, type };

    setToasts((prev) => [...prev, newToast]);

    const duration = TOAST_DURATION[type];
    const timeout = setTimeout(() => {
      dismiss(id);
    }, duration);

    timeoutsRef.current.set(id, timeout);
  }, [dismiss]);

  const toast = {
    success: useCallback((message: string) => addToast(message, 'success'), [addToast]),
    error: useCallback((message: string) => addToast(message, 'error'), [addToast]),
    info: useCallback((message: string) => addToast(message, 'info'), [addToast]),
    warning: useCallback((message: string) => addToast(message, 'warning'), [addToast]),
  };

  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      {/* Toast container - fixed bottom-right */}
      <div
        className="fixed bottom-20 right-4 sm:bottom-24 sm:right-6 z-50 flex flex-col gap-2 max-w-xs w-full pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <Toast toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
