import { AppIcon as UiIcon } from './AppIcon';
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
    <div className="sb-modal-head"><h2 className="ops-panel-title">{title}</h2><button type="button" data-modal-close className="ops-button" aria-label={`Close ${title}`} onClick={() => closeRef.current()}><UiIcon name="close" size={18} /></button></div>
    {children}
  </dialog>, document.body);
}

export { useToast } from './Toast';

/** Tiny inline SVG bar chart for orders-by-day. */
export function BarChart({ data, height = 120 }: { data: Array<{ label: string; value: number }>; height?: number }) {
  if (data.length === 0) return <p className="py-6 text-center text-sm text-slate-400">No data in range.</p>;
  const max = Math.max(...data.map((d) => d.value), 1);
  const barW = 100 / data.length;
  return (
    <svg viewBox={`0 0 100 ${height / 4}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      {data.map((d, i) => {
        const h = (d.value / max) * (height / 4 - 4);
        return (
          <rect
            key={i}
            x={i * barW + barW * 0.15}
            y={height / 4 - h}
            width={barW * 0.7}
            height={h}
            rx={0.6}
            className="fill-emerald-500"
          >
            <title>{`${d.label}: ${d.value}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

export const inputCls =
  'ops-input w-full';
export const btnCls =
  'ops-button ops-button-primary';
export const btnGhost =
  'ops-button';
export const btnDanger =
  'ops-button ops-button-danger';
