import { Search, Settings, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleAccountLink } from './GoogleAccountLink';

const DESTINATIONS = [
  ['/', 'Overview'], ['/orders', 'All orders'], ['/merchants', 'Merchants'],
  ['/products', 'Catalogue moderation'], ['/categories', 'Categories & units'],
  ['/customers', 'Customers'], ['/riders', 'Merchant riders'],
  ['/refunds', 'Returns & refunds'], ['/support', 'Support inbox'],
  ['/settlements', 'Settlements & COD'], ['/coupons', 'Promotions'], ['/audit', 'Audit activity'],
] as const;

export default function AdminHeaderTools({ openTheme }: { openTheme: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const matches = DESTINATIONS.filter(([, label]) => label.toLowerCase().includes(query.trim().toLowerCase()));

  return <>
    <div className="ops-header-search">
      <Search size={16} aria-hidden="true" />
      <input aria-label="Find admin page" placeholder="Find a page…" value={query}
        onFocus={() => setSearchOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setSearchOpen(false);
          if (event.key === 'Enter' && matches[0]) { navigate(matches[0][0]); setSearchOpen(false); setQuery(''); }
        }}
        onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }} />
      {query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><X size={14} /></button>}
      {searchOpen && query && <div className="ops-header-results" role="region" aria-label="Matching admin pages">
        {matches.length ? matches.map(([path, label]) => <Link key={path} to={path} onClick={() => { setSearchOpen(false); setQuery(''); }}>{label}</Link>) : <p>No matching pages. Try a different page name.</p>}
      </div>}
    </div>
    <div className="ops-header-settings">
      <button type="button" className="ops-button ops-icon-button" aria-label="Settings" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(!settingsOpen)}><Settings size={17} /></button>
      {settingsOpen && <div className="ops-settings-menu" role="region" aria-label="Admin settings">
        <strong>Workspace settings</strong>
        <GoogleAccountLink />
        <p>Platform preferences and permissions need a settings API; they are not editable here yet.</p>
        <button type="button" className="ops-button" onClick={() => { setSettingsOpen(false); openTheme(); }}>Open Theme Studio</button>
      </div>}
    </div>
  </>;
}
