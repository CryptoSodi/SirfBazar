'use client';

export function CoverageNotice({
  hasLocation,
  onChooseLocation,
  onRetry,
  className = '',
}: {
  hasLocation: boolean;
  onChooseLocation: () => void;
  onRetry: () => void;
  className?: string;
}) {
  return <section className={`card p-5 sm:p-6 ${className}`} aria-labelledby="no-local-shops-title">
    <h2 id="no-local-shops-title" className="text-xl font-bold">{hasLocation ? 'No shops deliver to this area yet' : 'Choose where you need delivery'}</h2>
    <p className="sb-muted mt-2">{hasLocation ? 'No approved shop currently serves this pin. Try another delivery location to check coverage.' : 'SirfBazar uses your chosen location to show only shops that can deliver there. Your location is saved in this browser only after you confirm it.'}</p>
    <button className="btn-primary mt-4" onClick={onChooseLocation}>{hasLocation ? 'Change delivery location' : 'Choose delivery location'}</button>
    {hasLocation && <button className="btn-secondary mt-4 ml-2" onClick={onRetry}>Try again</button>}
  </section>;
}
