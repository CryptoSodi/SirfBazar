import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { tone } from '../lib/api';

export function Badge({ value }: { value: string }) {
  if (!value) return null;
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tone(value)}`}>
      {value.replace(/_/g, ' ')}
    </span>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="ops-stat">
      <div className="ops-stat-label">{label}</div>
      <div className="ops-stat-value">{value}</div>
      {hint && <div className="ops-stat-hint">{hint}</div>}
    </div>
  );
}

export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="ops-table-wrap">
      <table className="ops-table">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const dialog = dialogRef.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    dialog?.querySelector<HTMLButtonElement>('[data-modal-close]')?.focus();
    return () => { if (dialog?.open) dialog.close(); previous?.focus(); };
  }, []);
  return createPortal(<dialog ref={dialogRef} className="sb-modal" aria-label={title} onCancel={(e) => { e.preventDefault(); closeRef.current(); }} onClick={(e) => { if (e.target === e.currentTarget) closeRef.current(); }}>
    <div className="sb-modal-head"><h2 className="ops-panel-title">{title}</h2><button type="button" data-modal-close className="ops-button" aria-label={`Close ${title}`} onClick={() => closeRef.current()}>✕</button></div>
    {children}
  </dialog>, document.body);
}

export function useToast() {
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  useEffect(() => {
    if (!msg || !msg.ok) return;
    const t = setTimeout(() => setMsg(null), 3500);
    return () => clearTimeout(t);
  }, [msg]);
  const toast = useCallback((text: string, ok = true) => setMsg({ text, ok }), []);
  const node = msg ? (
    <div
      role={msg.ok ? 'status' : 'alert'}
      className={`fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-lg ${
        msg.ok ? 'bg-emerald-600' : 'bg-red-600'
      }`}
    >
      {msg.text}{!msg.ok && <button type="button" className="ml-3 underline" aria-label="Dismiss error" onClick={() => setMsg(null)}>Dismiss</button>}
    </div>
  ) : null;
  return { toast, node };
}

export const inputCls =
  'ops-input w-full';
export const btnCls =
  'ops-button ops-button-primary';
export const btnGhost =
  'ops-button';
export const btnDanger =
  'ops-button ops-button-danger';
