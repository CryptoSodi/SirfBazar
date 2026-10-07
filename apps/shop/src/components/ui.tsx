import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ReferenceIcon } from './ReferenceIcon';

export function Badge({ value }: { value: string }) {
  if (!value) return null;
  const normalized = value.toUpperCase();
  const colour = ['APPROVED', 'ACTIVE', 'ONLINE', 'AVAILABLE', 'READY_FOR_PICKUP', 'DELIVERED', 'PAID'].some((item) => normalized.includes(item)) ? 'green'
    : ['PENDING', 'SENT_TO_MERCHANT', 'NEW'].some((item) => normalized.includes(item)) ? 'amber'
    : ['REJECTED', 'CANCELLED', 'DISABLED', 'OUT_OF_STOCK'].some((item) => normalized.includes(item)) ? 'red' : 'blue';
  return <span className={`badge ${colour}`}><span className="dot" />{value.replace(/_/g, ' ')}</span>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return <div className="metric"><div className="label">{label}</div><div className="value">{value}</div>{hint && <div className="sub">{hint}</div>}</div>;
}

export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return <div className="table-wrap"><table><thead><tr>{headers.map((heading) => <th key={heading} scope="col">{heading}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
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
  return createPortal(<dialog ref={dialogRef} className="drawer" aria-label={title} onCancel={(event) => { event.preventDefault(); closeRef.current(); }} onClick={(event) => { if (event.target === event.currentTarget) closeRef.current(); }}><div className="dialog-inner"><div className="dialog-head"><div><div className="kicker">Merchant workspace</div><h2>{title}</h2></div><button type="button" data-modal-close className="icon-btn" aria-label={`Close ${title}`} onClick={() => closeRef.current()}><ReferenceIcon name="close" /></button></div><div className="dialog-body">{children}</div></div></dialog>, document.body);
}

export function useToast() {
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  useEffect(() => { if (!msg || !msg.ok) return; const timer = setTimeout(() => setMsg(null), 3500); return () => clearTimeout(timer); }, [msg]);
  const toast = useCallback((text: string, ok = true) => setMsg({ text, ok }), []);
  const node = msg ? <div role={msg.ok ? 'status' : 'alert'} className="toast">{msg.text}{!msg.ok && <button type="button" className="btn tiny" aria-label="Dismiss error" onClick={() => setMsg(null)}>Dismiss</button>}</div> : null;
  return { toast, node };
}

export const inputCls = 'field-control';
export const btnCls = 'btn primary';
export const btnGhost = 'btn';
export const btnDanger = 'btn danger';
