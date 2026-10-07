function Block({ className = '' }: { className?: string }) {
  return <span className={`skeleton ${className}`} aria-hidden="true" />;
}

export function LoadingFrame({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="skeleton-screen" role="status" aria-live="polite" aria-busy="true">
    <span className="sr-only">{label}</span>{children}
  </div>;
}

export function PageSkeleton({ variant = 'table', label = 'Loading page' }: { variant?: 'table' | 'cards' | 'settings'; label?: string }) {
  return <LoadingFrame label={label}>
    <div className="page-heading skeleton-heading"><div><Block className="skeleton-kicker" /><Block className="skeleton-title" /><Block className="skeleton-copy" /></div><Block className="skeleton-button" /></div>
    {variant === 'cards' ? <CardSkeleton /> : variant === 'settings' ? <SettingsSkeleton /> : <TableSkeleton />}
  </LoadingFrame>;
}

export function DashboardSkeleton() {
  return <LoadingFrame label="Loading your workspace">
    <div className="page-heading skeleton-heading"><div><Block className="skeleton-kicker" /><Block className="skeleton-title wide" /><Block className="skeleton-copy" /></div><Block className="skeleton-button" /></div>
    <div className="metrics skeleton-metrics">{Array.from({ length: 4 }, (_, i) => <div className="metric" key={i}><Block className="skeleton-copy short" /><Block className="skeleton-value" /><Block className="skeleton-copy" /></div>)}</div>
    <div className="pipeline skeleton-pipeline">{Array.from({ length: 4 }, (_, i) => <div className="stage" key={i}><Block className="skeleton-circle" /><span><Block className="skeleton-copy short" /><Block className="skeleton-copy" /></span></div>)}</div>
    <div className="columns"><TableSkeleton compact /><CardSkeleton compact /></div>
  </LoadingFrame>;
}

export function TableSkeleton({ rows = 6, compact = false }: { rows?: number; compact?: boolean }) {
  return <section className="panel skeleton-panel" aria-hidden="true"><div className="panel-head"><div><Block className="skeleton-subtitle" /><Block className="skeleton-copy" /></div></div><div className="skeleton-table">{Array.from({ length: compact ? 4 : rows }, (_, i) => <div className="skeleton-table-row" key={i}><Block className="skeleton-copy short" /><Block className="skeleton-copy" /><Block className="skeleton-copy short" /><Block className="skeleton-pill" /></div>)}</div></section>;
}

export function CardSkeleton({ compact = false }: { compact?: boolean }) {
  return <section className="skeleton-card-grid" aria-hidden="true">{Array.from({ length: compact ? 4 : 6 }, (_, i) => <div className="panel skeleton-card" key={i}><Block className="skeleton-circle" /><Block className="skeleton-subtitle" /><Block className="skeleton-copy" /><Block className="skeleton-pill" /></div>)}</section>;
}

export function SettingsSkeleton() {
  return <div className="columns" aria-hidden="true"><section className="panel skeleton-settings"><Block className="skeleton-subtitle" />{Array.from({ length: 6 }, (_, i) => <div className="skeleton-setting" key={i}><Block className="skeleton-copy short" /><Block className="skeleton-copy" /></div>)}</section><section className="panel skeleton-settings"><Block className="skeleton-subtitle" />{Array.from({ length: 4 }, (_, i) => <div className="skeleton-setting" key={i}><Block className="skeleton-copy short" /><Block className="skeleton-pill" /></div>)}</section></div>;
}

export function InlineSkeleton({ label = 'Loading details', rows = 3 }: { label?: string; rows?: number }) {
  return <div className="skeleton-screen skeleton-screen-inline" role="status" aria-live="polite" aria-busy="true"><span className="sr-only">{label}</span><div className="skeleton-inline" aria-hidden="true">{Array.from({ length: rows }, (_, i) => <Block className={i === 0 ? 'skeleton-subtitle' : `skeleton-copy${i % 2 ? '' : ' short'}`} key={i} />)}</div></div>;
}
