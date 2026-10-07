import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Maximize, Minimize } from 'lucide-react';

type Mode = 'off' | 'browser' | 'window';

export default function IPosFullscreen() {
  const [mode, setMode] = useState<Mode>('off');
  const modeRef = useRef<Mode>('off');
  const [changing, setChanging] = useState(false);
  const changingRef = useRef(false);
  const [message, setMessage] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const mounted = useRef(true);
  const ownsNative = useRef(false);
  const hintId = useId();

  const applyMode = useCallback((next: Mode) => {
    modeRef.current = next;
    if (next === 'off') delete document.documentElement.dataset.iposFullscreen;
    else document.documentElement.dataset.iposFullscreen = next;
    if (mounted.current) setMode(next);
  }, []);
  const restoreFocus = () => {
    // Do not steal focus from a payment/confirmation dialog on a browser exit.
    if (mounted.current && !document.querySelector('dialog[open]')) buttonRef.current?.focus();
  };

  useEffect(() => {
    mounted.current = true;
    const changed = () => {
      if (!ownsNative.current) return;
      if (document.fullscreenElement === document.documentElement) {
        applyMode('browser');
        setMessage('Press Esc or choose Exit full screen to return.');
      } else {
        ownsNative.current = false;
        applyMode('off');
        setMessage('Dashboard view restored.');
        restoreFocus();
      }
    };
    const escape = (event: KeyboardEvent) => {
      // Let the browser own native-fullscreen Escape and the topmost modal own
      // its cancel action. No F11 binding: existing POS profiles already use it.
      if (modeRef.current !== 'window' || event.key !== 'Escape' || event.defaultPrevented || event.isComposing || document.querySelector('dialog[open]')) return;
      event.preventDefault();
      applyMode('off');
      setMessage('Dashboard view restored.');
      restoreFocus();
    };
    document.addEventListener('fullscreenchange', changed);
    window.addEventListener('keydown', escape);
    return () => {
      mounted.current = false;
      document.removeEventListener('fullscreenchange', changed);
      window.removeEventListener('keydown', escape);
      delete document.documentElement.dataset.iposFullscreen;
      if (ownsNative.current && document.fullscreenElement === document.documentElement) void document.exitFullscreen().catch(() => {});
    };
  }, [applyMode]);

  async function toggle() {
    if (changingRef.current) return;
    changingRef.current = true; setChanging(true);
    const root = document.documentElement;
    try {
      if (modeRef.current !== 'off') {
        if (ownsNative.current && document.fullscreenElement === root) await document.exitFullscreen();
        ownsNative.current = false;
        applyMode('off');
        if (mounted.current) { setMessage('Dashboard view restored.'); restoreFocus(); }
        return;
      }
      if (root.requestFullscreen && document.fullscreenEnabled && !document.fullscreenElement) {
        ownsNative.current = true;
        try {
          // Request synchronously from the button's user gesture. Fullscreen the
          // root, not the register, to keep body-portaled dialogs/receipts usable.
          await root.requestFullscreen();
          if (!mounted.current) {
            if (ownsNative.current && document.fullscreenElement === root) await document.exitFullscreen();
            return;
          }
          if (ownsNative.current && document.fullscreenElement === root) {
            applyMode('browser'); setMessage('Press Esc or choose Exit full screen to return.');
          }
          return;
        } catch {
          ownsNative.current = false;
        }
      }
      if (mounted.current) {
        applyMode('window');
        setMessage('Browser full screen is unavailable. Counter expanded in this window; press Esc or choose Exit expanded view to return.');
      }
    } catch {
      if (mounted.current) setMessage('Could not exit full screen. Press Esc to return, or try the exit button again.');
    } finally {
      changingRef.current = false;
      if (mounted.current) {
        setChanging(false);
        if (modeRef.current === 'off') window.requestAnimationFrame(restoreFocus);
      }
    }
  }

  return <div className="ipos-fullscreen-control">
    {/* Keep focus during browser transitions; changingRef blocks repeat activation. */}
    <button ref={buttonRef} type="button" className="ops-button" aria-disabled={changing} aria-describedby={hintId} onClick={() => void toggle()}>
      {mode === 'off' ? <Maximize size={17} aria-hidden="true" /> : <Minimize size={17} aria-hidden="true" />}
      {mode === 'off' ? 'Full screen' : mode === 'browser' ? 'Exit full screen' : 'Exit expanded view'}
    </button>
    <span id={hintId} className="ipos-fullscreen-hint" role="status">{message}</span>
  </div>;
}
