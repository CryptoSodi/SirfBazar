import './availability-switch.css';

export function AvailabilitySwitch({ open, disabled, busy, onToggle }: {
  open: boolean;
  disabled?: boolean;
  busy?: boolean;
  onToggle: () => void;
}) {
  return <button
    type="button"
    className="availability-switch"
    role="switch"
    aria-label="Accept customer orders"
    aria-checked={open}
    aria-busy={busy || undefined}
    disabled={disabled || busy}
    onClick={onToggle}
  >
    <span className={`availability-track${open ? ' online' : ''}`} aria-hidden="true"><span className="availability-thumb" /></span>
    <span className="availability-label">{open ? 'Shop on' : 'Shop closed'}</span>
    {busy && <span className="availability-saving" role="status">Saving…</span>}
  </button>;
}
