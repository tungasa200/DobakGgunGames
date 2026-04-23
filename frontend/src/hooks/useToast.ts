import { useState, useCallback } from 'react';

export interface Toast {
  id: number;
  message: string;
  type: 'error' | 'info';
}

let seq = 0;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: 'error' | 'info' = 'error') => {
    const id = ++seq;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}
