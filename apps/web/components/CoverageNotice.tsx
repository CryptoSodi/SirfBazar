'use client';

export function CoverageNotice({
  inExampleArea,
  onBrowseExample,
  onRetry,
  className = '',
}: {
  inExampleArea: boolean;
  onBrowseExample: () => void;
  onRetry: () => void;
  className?: string;
}) {
  return <section className={`card p-5 sm:p-6 ${className}`} aria-labelledby="no-local-shops-title">
    <h2 id="no-local-shops-title" className="text-xl font-bold">No shops deliver to this area yet</h2>
    <p className="sb-muted mt-2">{inExampleArea ? 'No shops are available in the Gulberg example right now. Try loading them again.' : 'This location is outside the shops’ delivery areas in this preview. Browse the Gulberg example to see how shopping works; it is not your delivery address.'}</p>
    {inExampleArea
      ? <button className="btn-secondary mt-4" onClick={onRetry}>Try again</button>
      : <button className="btn-primary mt-4" onClick={onBrowseExample}>Browse Gulberg example</button>}
  </section>;
}
