import { createContext, useCallback, useContext, useState } from 'react';

/**
 * Toast state. `useToastState` owns it; `useToast` reads the shared instance
 * that AppShell provides, so the whole page has exactly one toast rather than
 * one per component that can copy something.
 */
export const useToastState = () => {
  const [message, setMessage] = useState<string>('');
  const [isVisible, setIsVisible] = useState<boolean>(false);
  // Bumped on every showToast so Toast's effect re-arms its dismiss timer even
  // when a second toast is raised while the first is still on screen.
  const [nonce, setNonce] = useState<number>(0);

  const showToast = useCallback((text: string) => {
    setMessage(text);
    setIsVisible(true);
    setNonce(n => n + 1);
  }, []);

  const hideToast = useCallback(() => setIsVisible(false), []);

  return { message, isVisible, nonce, showToast, hideToast };
};

export type ToastApi = ReturnType<typeof useToastState>;

const NOOP_TOAST: ToastApi = {
  message: '',
  isVisible: false,
  nonce: 0,
  showToast: () => {},
  hideToast: () => {},
};

export const ToastContext = createContext<ToastApi>(NOOP_TOAST);

/** Raise a toast from anywhere inside AppShell. */
export const useToast = (): ToastApi => useContext(ToastContext);
