import './availability-switch.css';

export function AvailabilitySwitch({ online, disabled, busy, onToggle }: {
  online: boolean;
  disabled?: boolean;
  busy?: boolean;
  onToggle: () => void;
}) {
  return <button
    type="button"
    className="availability-switch"
    role="switch"
    aria-label="Shop availability"
    aria-checked={online}
    aria-busy={busy || undefined}
    disabled={disabled || busy}
    onClick={onToggle}
  >
    <span className={`availability-track${online ? ' online' : ''}`} aria-hidden="true"><span className="availability-thumb" /></span>
    <span className="availability-label">{online ? 'Online' : 'Offline'}</span>
    {busy && <span className="availability-saving" role="status">Saving…</span>}
  </button>;
}
