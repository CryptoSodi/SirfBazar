'use client';
import { useEffect, useState, type ReactNode, Children, isValidElement } from 'react';
import { createPortal } from 'react-dom';
import { friendlyError } from '../lib/friendly-error';

type Message = { id: number; text: string; ok: boolean };
let sequence = 0;
let queue: Message[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());
export function toast(text: string, ok = true) {
  if (!text) return;
  const safe = ok ? text : friendlyError(text);
  if (queue.some(item => item.text === safe && item.ok === ok)) return;
  queue = [...queue, { id: ++sequence, text: safe, ok }];
  emit();
}
function dismiss(id: number) { queue = queue.filter(item => item.id !== id); emit(); }
export function useToast() { return { toast, node: null }; }
function textOf(node: ReactNode): string {
  return Children.toArray(node).map(item => typeof item === 'string' || typeof item === 'number' ? String(item) : isValidElement<{ children?: ReactNode }>(item) ? textOf(item.props.children) : '').join('');
}
/** Bridge existing request state to a single floating notification host. */
export function ToastMessage({ message, children, ok = false }: { message?: string; children?: ReactNode; ok?: boolean }) {
  const text = message ?? textOf(children);
  useEffect(() => { if (text) toast(text, ok); }, [text, ok]);
  return null;
}
export function ToastHost() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const sync = () => setMessages([...queue]);
    listeners.add(sync); sync();
    const locate = () => {
      const dialogs = Array.from(document.querySelectorAll<HTMLElement>('dialog[open], [role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]'));
      setTarget(dialogs.at(-1) ?? document.fullscreenElement as HTMLElement ?? document.body);
    };
    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });
    document.addEventListener('fullscreenchange', locate);
    return () => { listeners.delete(sync); observer.disconnect(); document.removeEventListener('fullscreenchange', locate); };
  }, []);
  const current = messages[0];
  useEffect(() => {
    if (!current?.ok || paused) return;
    const timer = setTimeout(() => dismiss(current.id), 5000);
    return () => clearTimeout(timer);
  }, [current?.id, current?.ok, paused]);
  if (!target) return null;
  return createPortal(<div data-toast-host style={{ position: 'fixed', insetInline: 16, bottom: 'max(24px, env(safe-area-inset-bottom))', zIndex: 2147483647, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
    <div role="status" aria-live="polite" aria-atomic="true">{current?.ok && <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}>{current.text}</span>}</div>
    {current && <div role={current.ok ? undefined : 'alert'} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)} style={{ pointerEvents: 'auto', width: 'min(100%, 480px)', maxHeight: '40dvh', overflowY: 'auto', padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center', borderRadius: 12, background: '#19221e', color: '#ffffff', border: '1px solid #82978c', boxShadow: '0 8px 28px #0003', fontSize: 14, lineHeight: 1.5, textAlign: 'start', overflowWrap: 'anywhere' }}>
      <div style={{ flex: 1, minWidth: 0 }}><strong style={{ display: 'block', color: current.ok ? '#75ddb0' : '#ffd08b', marginBottom: 3 }}>{current.ok ? 'Done' : 'Please check'}</strong>{current.text}{messages.length > 1 && <small style={{ display: 'block', marginTop: 6 }}>{messages.length - 1} more notifications</small>}</div>
      <button type="button" aria-label="Dismiss notification" onClick={() => dismiss(current.id)} style={{ flexShrink: 0, minHeight: 44, padding: '8px 10px', border: '1px solid #82978c', borderRadius: 7, color: '#fff', background: 'transparent', font: 'inherit', cursor: 'pointer' }}>Dismiss</button>
    </div>}
  </div>, target);
}
