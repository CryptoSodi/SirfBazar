'use client';

import { useEffect, useRef, type KeyboardEvent } from 'react';

/** Keep keyboard focus inside an active modal and restore the trigger on close. */
export function useModalFocus<T extends HTMLElement>(active: boolean, onClose?: () => void, restoreTo?: HTMLElement | null) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.focus();
    return () => (restoreTo?.isConnected ? restoreTo : previous)?.focus();
  }, [active, restoreTo]);

  const onKeyDown = (event: KeyboardEvent<T>) => {
    if (event.key === 'Escape' && onClose) {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = Array.from(ref.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)') ?? []);
    if (!controls.length) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === controls[0] || document.activeElement === ref.current)) {
      event.preventDefault();
      controls.at(-1)?.focus();
    } else if (!event.shiftKey && (document.activeElement === controls.at(-1) || document.activeElement === ref.current)) {
      event.preventDefault();
      controls[0].focus();
    }
  };

  return { ref, onKeyDown };
}
