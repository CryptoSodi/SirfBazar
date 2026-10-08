import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Barcode, CheckCircle2, History, Keyboard, Monitor, Pause, Plus, Printer, RefreshCw, Search, Settings, ShoppingBasket, Trash2, Wallet } from 'lucide-react';
import { api, ApiError, errorMessage, getUser } from '../lib/api';
import { readProfile, type MerchantProfile } from '../lib/merchant-contracts';
import { Modal, useToast } from '../components/ui';
import IPosSettings from '../components/IPosSettings';
import IPosClassicBill from '../components/IPosClassicBill';
import IPosFullscreen from '../components/IPosFullscreen';
import { activeCommands, addProduct, addUnits, counterKey, money, parseCash, paymentPayload, readCounter, readProduct, readProducts, readSale, setLineQuantity, shortcutAction, shortcutProfiles, ticket, total, voidUnit,
  type CommandId, type CounterState, type PosProduct, type PosSale, type SalePayload } from '../lib/ipos';
import './ipos.css';

type View = 'register' | 'held' | 'sales' | 'settings';
type Dialog = 'payment' | 'discard' | 'help' | 'quantity' | 'multi' | 'exit' | null;

export default function IPos() {
  const [profile, setProfile] = useState<MerchantProfile | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const user = getUser();
  useEffect(() => {
    document.body.classList.add('ipos-active');
    return () => document.body.classList.remove('ipos-active');
  }, []);
  useEffect(() => {
    let active = true;
    document.title = 'iPOS · SirfBazar merchant';
    setError('');
    void Promise.all([api.get('/merchant/profile'), api.get('/pos/capabilities')]).then(([raw, capabilities]) => {
      const p = readProfile(raw);
      if (!p.isOwner && !p.permissions.includes('POS')) throw Error('Ask the shop owner to grant POS permission to your staff account.');
      if (capabilities?.version !== 2 || !capabilities.idempotentSales || !capabilities.barcodeLookup || capabilities.merchantId !== p.id) {
        throw Error('This counter needs the updated POS API. Ask your administrator to deploy the matching backend, then retry.');
      }
      if (active) setProfile(p);
    }).catch((cause) => { if (active) setError(cause instanceof ApiError && cause.status === 404
      ? 'The running API does not yet include the iPOS update. Deploy the updated POS backend, then retry.' : `${errorMessage(cause)} Check API access or ask the shop owner for POS permission.`); });
    return () => { active = false; };
  }, [attempt, user?.id]);
  if (error) return <section className="ops-panel"><h1 className="ops-page-title">iPOS</h1><p className="ipos-error" role="alert">{error}</p><button className="ops-button" onClick={() => setAttempt((v) => v + 1)}>Retry connection</button></section>;
  if (!profile || !user?.id) return <section className="ops-panel" role="status">Loading iPOS and checking cashier access…</section>;
  return <Counter key={`${profile.id}:${user.id}`} profile={profile} userId={user.id} cashier={user.fullName || user.phoneNumber || 'Cashier'} />;
}

function Counter({ profile, userId, cashier }: { profile: MerchantProfile; userId: string; cashier: string }) {
  const navigate = useNavigate();
  const storageKey = counterKey(profile.id, userId);
  const [state, setState] = useState<CounterState | null>(null);
  const stateRef = useRef<CounterState | null>(null);
  const rawRef = useRef<string | null>(null);
  const [fatal, setFatal] = useState('');
  const [ownsCounter, setOwnsCounter] = useState(false);
  const ownsRef = useRef(false);
  const [lockAttempt, setLockAttempt] = useState(0);
  const [view, setView] = useState<View>('register');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [receipt, setReceipt] = useState<PosSale | null>(null);
  const [error, setError] = useState('');
  const [notice, setNoticeState] = useState<{ text: string } | null>(null);
  const setNotice = (text: string) => setNoticeState({ text });
  const { toast, node: toastNode } = useToast();
  useEffect(() => { if (notice) toast(notice.text); }, [notice, toast]);
  const recoveryError = !!state?.pending || /bill has not been cleared|bill is retained|do not take payment again|saved sale|contact support/i.test(error);
  const paymentFieldError = dialog === 'payment' && /cash received|cash amount|enter cash/i.test(error) && !recoveryError;
  useEffect(() => { if (error && !recoveryError && !paymentFieldError) toast(error, false); }, [error, recoveryError, paymentFieldError, toast]);
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [query, setQuery] = useState('');
  const [catalogueError, setCatalogueError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [scan, setScan] = useState('');
  const [scanCount, setScanCount] = useState(0);
  const scanCountRef = useRef(0);
  const scanQueue = useRef(Promise.resolve());
  const scanInput = useRef<HTMLInputElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const cashInput = useRef<HTMLInputElement>(null);
  const [cash, setCash] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const alive = useRef(true);
  const [sales, setSales] = useState<PosSale[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesError, setSalesError] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('today');
  const [voidMode, setVoidMode] = useState(false);
  const [voidId, setVoidId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [quantityText, setQuantityText] = useState('1');
  const [quantityError, setQuantityError] = useState('');
  const [nextQuantity, setNextQuantityState] = useState(1);
  const nextQuantityRef = useRef(1);
  function setNextQuantity(value: number) { nextQuantityRef.current = value; setNextQuantityState(value); }
  const settingsDirty = useRef(false);
  const markSettingsDirty = useCallback((dirty: boolean) => { settingsDirty.current = dirty; }, []);

  useEffect(() => {
    alive.current = true;
    const connection = () => setOnline(navigator.onLine);
    window.addEventListener('online', connection); window.addEventListener('offline', connection);
    return () => { alive.current = false; window.removeEventListener('online', connection); window.removeEventListener('offline', connection); };
  }, []);
  useEffect(() => {
    let cancelled = false;
    let release: (() => void) | undefined;
    const read = () => {
      try { const raw = localStorage.getItem(storageKey); const stored = readCounter(raw); rawRef.current = raw; stateRef.current = stored; setState(stored); }
      catch (cause) { setFatal(errorMessage(cause)); }
    };
    read();
    if (!navigator.locks) { setFatal('This browser cannot safely reserve a counter tab. Use a current browser on HTTPS or localhost; do not clear existing counter data.'); return; }
    void navigator.locks.request(storageKey, { ifAvailable: true }, async (lock) => {
      if (cancelled || !lock) return;
      read(); ownsRef.current = true; setOwnsCounter(true);
      await new Promise<void>((resolve) => { release = resolve; });
    }).catch(() => { if (!cancelled) setFatal('Unable to reserve this counter. Close duplicate tabs and reload.'); });
    const changed = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      if (ownsRef.current) setFatal('Counter data changed outside this tab. Reload before continuing; do not clear site data.');
      else read();
    };
    window.addEventListener('storage', changed);
    return () => { cancelled = true; ownsRef.current = false; setOwnsCounter(false); release?.(); window.removeEventListener('storage', changed); };
  }, [storageKey, lockAttempt]);

  const commit = useCallback((next: CounterState): boolean => {
    try {
      if (!ownsRef.current) throw Error('This counter is open in another tab. Close that tab, then choose “Use this tab”.');
      if (localStorage.getItem(storageKey) !== rawRef.current) throw Error('Counter data changed in another tab. Reload before continuing.');
      const raw = JSON.stringify(next);
      localStorage.setItem(storageKey, raw); rawRef.current = raw; stateRef.current = next; setState(next); return true;
    } catch (cause) { setError(`${errorMessage(cause)} Your current bill has not been cleared. If storage is full or blocked, contact support before taking payment.`); return false; }
  }, [storageKey]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true); setCatalogueError('');
      void api.get(`/pos/products${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`).then((raw) => {
        const rows = readProducts(raw); if (active) setProducts(rows);
      }).catch((cause) => { if (active) { setProducts([]); setCatalogueError(`${errorMessage(cause)} Retry or change the search.`); } }).finally(() => { if (active) setLoading(false); });
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, refresh]);

  useEffect(() => {
    if (view !== 'sales') return;
    let active = true;
    const from = new Date(); from.setHours(0, 0, 0, 0); if (dateRange === 'week') from.setDate(from.getDate() - 6);
    setSalesLoading(true); setSalesError('');
    void api.get(`/pos/sales?from=${encodeURIComponent(from.toISOString())}`).then((raw) => {
      if (!Array.isArray(raw?.sales)) throw Error('Unexpected sales response.');
      const rows = raw.sales.map(readSale); if (active) setSales(rows);
    }).catch((cause) => { if (active) { setSales([]); setSalesError(`${errorMessage(cause)} Retry loading sales.`); } }).finally(() => { if (active) setSalesLoading(false); });
    return () => { active = false; };
  }, [view, dateRange, refresh]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (settingsDirty.current || stateRef.current?.pending || busyRef.current || scanCountRef.current) event.preventDefault(); };
    const leaving = (event: MouseEvent) => {
      if (settingsDirty.current && event.target instanceof Element && event.target.closest('a[href]') && !window.confirm('Leave without saving your POS preferences?')) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener('beforeunload', warn); document.addEventListener('click', leaving, true);
    return () => { window.removeEventListener('beforeunload', warn); document.removeEventListener('click', leaving, true); };
  }, []);

  const locked = !ownsCounter || busy || !!state?.pending || scanCount > 0;
  function resetEntry() { setVoidMode(false); setNextQuantity(1); setSelectedId(''); setCash(''); setScan(''); }
  function toggleAppearance() {
    const current = stateRef.current;
    if (!current || !ownsRef.current || busyRef.current || scanCountRef.current) return;
    if (settingsDirty.current && !window.confirm('Leave without saving your POS preferences?')) return;
    const appearance = current.settings.appearance === 'modern' ? 'classic' : 'modern';
    if (commit({ ...current, settings: { ...current.settings, appearance } })) {
      setView('register'); setNotice(`${appearance === 'classic' ? 'Classic' : 'Modern'} appearance saved. Bill and keyboard profile unchanged.`);
    }
  }
  function changeView(next: View) {
    if (busyRef.current || scanCountRef.current) { setError('Wait for the current scan or sale request to finish.'); return; }
    if (next !== view && settingsDirty.current && !window.confirm('Leave without saving your POS preferences?')) return;
    if (next !== view) { setVoidMode(false); setNextQuantity(1); setScan(''); }
    setView(next); setError('');
  }
  function add(product: PosProduct, units = 1): boolean {
    const current = stateRef.current;
    if (!current || current.pending || busyRef.current || !ownsRef.current) return false;
    try {
      if (!current.settings.mergeScans && current.draft.lines.some((line) => line.product.merchantProductId === product.merchantProductId)) throw Error('This item is already on the bill. Use its quantity controls to add another unit.');
      const lines = addUnits(current.draft.lines, product, units);
      if (commit({ ...current, draft: { ...current.draft, lines } })) { setSelectedId(product.merchantProductId); setNotice(`${units} × ${product.name} added to the bill.`); setError(''); return true; }
    } catch (cause) { setError(errorMessage(cause)); }
    return false;
  }
  function selectProduct(product: PosProduct) {
    if (locked) return;
    if (voidMode) { requestVoid(product.merchantProductId); return; }
    if (add(product, nextQuantity)) setNextQuantity(1);
  }
  function requestVoid(id: string) {
    if (!stateRef.current?.draft.lines.some((line) => line.product.merchantProductId === id)) { setError('This item is not on the unpaid bill. Choose a bill item or return to Sale mode.'); return; }
    setVoidId(id); setError('');
  }
  function submitScan() {
    const code = scan.trim();
    if (!code || !ownsRef.current || stateRef.current?.pending || busyRef.current) return;
    if (voidMode) {
      setScan('');
      const matches = stateRef.current?.draft.lines.filter(({ product }) => product.barcode === code || product.merchantSku === code) ?? [];
      if (matches.length !== 1) { setError(matches.length ? 'More than one bill item uses this code. Select the item in the bill.' : 'This code is not on the unpaid bill. Scan a bill item or return to Sale mode.'); return; }
      requestVoid(matches[0].product.merchantProductId); return;
    }
    setScan(''); scanCountRef.current++; setScanCount(scanCountRef.current);
    scanQueue.current = scanQueue.current.then(async () => {
      try {
        const product = readProduct(await api.get(`/pos/products/lookup?code=${encodeURIComponent(code)}`));
        // Read the one-shot multiplier at execution time, so rapid queued scans
        // cannot all consume it. A failed lookup leaves it available for retry.
        if (alive.current && add(product, nextQuantityRef.current)) setNextQuantity(1);
      } catch (cause) { if (alive.current) setError(errorMessage(cause)); }
      finally { scanCountRef.current--; if (alive.current) setScanCount(scanCountRef.current); }
    });
  }
  function hold() {
    const current = stateRef.current; if (!current || locked) return;
    if (!current.draft.lines.length) { setError('Add an item before holding a bill.'); return; }
    if (current.held.length >= 20) { setError('There are 20 held bills. Recall or discard one before holding another.'); return; }
    if (commit({ ...current, draft: ticket(), held: [...current.held, current.draft] })) { resetEntry(); setNotice('Bill held in this browser.'); setError(''); scanInput.current?.focus(); }
  }
  function pay() {
    if (locked || !state?.draft.lines.length) { toast('Add items and finish pending scans before taking payment.', false); return; }
    if (!navigator.onLine) { setError('Reconnect before completing a sale. The unpaid bill stays in this browser.'); return; }
    setCash(''); setError(''); setDialog('payment');
  }
  function openQuantity(id = selectedId) {
    const current = stateRef.current;
    const line = current?.draft.lines.find((item) => item.product.merchantProductId === id) ?? current?.draft.lines[0];
    if (!line) { setError('Add an item before changing quantity.'); return; }
    setSelectedId(line.product.merchantProductId); setQuantityText(String(line.quantity)); setQuantityError(''); setDialog('quantity');
  }
  function runCommand(id: CommandId) {
    if (locked) return;
    if (id === 'help') { setDialog('help'); return; }
    setDialog(null);
    if (id === 'scan') scanInput.current?.focus();
    if (id === 'search') { searchInput.current?.scrollIntoView({ block: 'center' }); searchInput.current?.focus(); }
    if (id === 'void') { setVoidMode((v) => !v); setNextQuantity(1); setScan(''); setNotice(voidMode ? 'Sale mode. Scans add items.' : 'Void mode. Scan a bill item to remove one unpaid unit after confirmation.'); scanInput.current?.focus(); }
    if (id === 'quantity') openQuantity();
    if (id === 'multi') { setQuantityText(String(nextQuantity)); setQuantityError(''); setDialog('multi'); }
    if (id === 'hold') hold();
    if (id === 'recall') changeView('held');
    if (id === 'sales') changeView('sales');
    if (id === 'settings') changeView('settings');
    if (id === 'payment') pay();
    if (id === 'reprint') { if (state?.lastReceipt) setReceipt(state.lastReceipt); else setError('No saved receipt in this browser. Open Sales history to find a completed sale.'); }
    if (id === 'reset') { if (state?.draft.lines.length) setDialog('discard'); else if (state && commit({ ...state, draft: ticket() })) { resetEntry(); setNotice('Ready for a new bill.'); } }
    if (id === 'exit') setDialog('exit');
  }
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (view !== 'register' || !state) return;
      const target = event.target;
      const editing = target instanceof Element && !!target.closest('input, textarea, select, [contenteditable="true"]');
      const action = shortcutAction(event, !!dialog || !!receipt || !!removeId || !!voidId || !!document.querySelector('dialog[open]'), state.settings, editing);
      if (!action) return;
      event.preventDefault();
      if (!locked) runCommand(action);
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  });

  function acceptSale(sale: PosSale) {
    const current = stateRef.current!;
    if (current.pending && sale.id !== current.pending.requestId) throw Error('The receipt reference does not match the pending sale. Contact support before continuing.');
    if (commit({ ...current, pending: null, draft: ticket(), lastReceipt: sale })) {
      resetEntry();
      setDialog(null); setReceipt(sale); setError(''); setNotice('Sale saved by the server.'); setRefresh((v) => v + 1);
    }
  }
  async function sendSale(payload: SalePayload) {
    if (busyRef.current || !ownsRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try { acceptSale(readSale(await api.post('/pos/sales', payload))); }
    catch (cause) {
      // 400 is a confirmed validation/stock/price rejection. Other outcomes are
      // held as pending, even 404/401/409, until the same request is resolved.
      if (cause instanceof ApiError && cause.status === 400) {
        const current = stateRef.current!;
        commit({ ...current, pending: null, draft: { ...current.draft, id: crypto.randomUUID() } });
        setDialog(null); setError(`${errorMessage(cause)} The bill is retained. Refresh prices or edit it before payment.`);
      } else setError(`${errorMessage(cause)} Do not take payment again. Check the saved sale below or retry the same request.`);
    } finally { busyRef.current = false; setBusy(false); }
  }
  async function checkPending() {
    const pending = stateRef.current?.pending; if (!pending || busyRef.current || !ownsRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try { acceptSale(readSale(await api.get(`/pos/sales/${encodeURIComponent(pending.requestId)}`))); }
    catch (cause) { setError(cause instanceof ApiError && cause.status === 404 ? 'The server has not returned this receipt yet. Retry the same request; do not start a replacement sale.' : `${errorMessage(cause)} Keep this sale reference and check again when connected.`); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function refreshBill() {
    const current = stateRef.current; if (!current || locked || !current.draft.lines.length) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      const rows = readProducts(await api.post('/pos/products/review', { merchantProductIds: current.draft.lines.map((line) => line.product.merchantProductId) }));
      const lines = current.draft.lines.map((line) => {
        const product = rows.find((p) => p.merchantProductId === line.product.merchantProductId);
        if (!product) throw Error(`${line.product.name} is no longer in the shop catalogue. Remove this item before payment.`);
        return { product, quantity: line.quantity };
      });
      if (commit({ ...current, draft: { ...current.draft, lines } })) setNotice('Bill prices refreshed. Review stock and the total before payment.');
    } catch (cause) { setError(errorMessage(cause)); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function openReceipt(id: string) {
    if (busyRef.current) return; busyRef.current = true; setBusy(true);
    try { setReceipt(readSale(await api.get(`/pos/sales/${encodeURIComponent(id)}`))); }
    catch (cause) { setError(`${errorMessage(cause)} Retry opening the receipt.`); }
    finally { busyRef.current = false; setBusy(false); }
  }

  if (fatal) return <section className="ops-panel"><h1 className="ops-page-title">iPOS counter recovery</h1><p className="ipos-error" role="alert">{fatal}</p><button className="ops-button" onClick={() => window.location.reload()}>Reload counter</button></section>;
  if (!state) return <p role="status">Opening counter…</p>;
  const lines = state.draft.lines;
  const subtotal = total(lines);
  const amount = parseCash(cash);
  const classic = state.settings.appearance === 'classic';
  const currentCommands = activeCommands(state.settings);
  const keyLabel = (id: CommandId) => state.settings.shortcuts && state.settings.bindings[id] ? <kbd>{state.settings.bindings[id]}</kbd> : null;
  return <div className={`ipos-workspace${classic ? ' ipos-classic' : ''}`}>
    <header className="ipos-heading"><div><div className="ipos-eyebrow"><Monitor size={16} aria-hidden="true" /> SIRFBAZAR COUNTER</div><h1>iPOS <span>Point of sale</span></h1><p>{profile.shopName} · {state.settings.counterName}</p></div><div className="ipos-heading-actions"><button type="button" className="ops-button" aria-pressed={classic} disabled={!ownsCounter || busy || scanCount > 0} onClick={toggleAppearance}>Classic appearance {classic ? 'On' : 'Off'}</button><IPosFullscreen /><button className="ops-button" onClick={() => setDialog('help')}><Keyboard size={17} aria-hidden="true" />Commands</button></div></header>
    <nav className="ipos-nav" aria-label="iPOS workspace">{([
      ['register', 'Register', Monitor], ['held', `Held bills (${state.held.length})`, Pause], ['sales', 'Sales history', History], ['settings', 'POS settings', Settings],
    ] as const).map(([id, label, Icon]) => <button type="button" key={id} aria-pressed={view === id} onClick={() => changeView(id)}><Icon size={17} aria-hidden="true" />{label}</button>)}</nav>
    <div className="ipos-statusbar"><span><strong>Cashier</strong> {cashier}</span><span><strong>Date</strong> {new Date().toLocaleDateString('en-PK')}</span><span><strong>Mode</strong> {voidMode ? 'VOID · unpaid items only' : 'SALE · cash'}</span><span><strong>Connection</strong> {online ? 'Browser online · API required' : 'Offline · checkout unavailable'}</span><span><strong>Keys</strong> {state.settings.shortcuts ? shortcutProfiles.find((p) => p.id === state.settings.shortcutProfile)?.label : 'Disabled'}</span></div>
    {!ownsCounter && <div className="ipos-notice" role="status"><strong>Read-only counter</strong><p>Another tab may be using this cashier’s counter. Close it before continuing here.</p><button className="ops-button" onClick={() => setLockAttempt((v) => v + 1)}>Use this tab</button></div>}
    {state.pending && <section className="ipos-notice ipos-pending"><h2>Sale result needs confirmation</h2><p>Do not charge again or create another bill. This request is saved in this browser.</p><p className="ipos-code">Reference: {state.pending.requestId}</p><div className="ipos-actions"><button className="ops-button ops-button-primary" disabled={busy || !ownsCounter} onClick={() => void checkPending()}>Check saved sale</button><button className="ops-button" disabled={busy || !ownsCounter} onClick={() => void sendSale(state.pending!)}>Retry same request</button></div></section>}
    {error && recoveryError && <div className="ipos-error" role="alert">{error}</div>}
    <p className="ipos-feedback" role="status">{scanCount ? `Looking up ${scanCount} scan${scanCount === 1 ? '' : 's'}…` : ''}</p>

    {view === 'register' && <>
      {(voidMode || nextQuantity !== 1) && <div className="ipos-notice ipos-mode-notice" role="status"><strong>{voidMode ? 'VOID MODE — unpaid bill only' : `Next addition: ${nextQuantity} units`}</strong><p>{voidMode ? 'Scan or select a bill item. Confirm before one unit is removed. Paid sales cannot be refunded here.' : 'Applies to the next successful scan or product selection, then returns to one unit.'}</p><button className="ops-button" disabled={locked} onClick={() => { setVoidMode(false); setNextQuantity(1); }}>Return to normal sale</button></div>}
      <div className="ipos-register">
        <section className="ipos-bill" aria-label="Current bill">
          <div className="ipos-section-heading"><div><h2>Current bill</h2><p className="ipos-muted">Walk-in customer · unpaid draft</p></div><span className="ipos-chip">{lines.reduce((sum, line) => sum + line.quantity, 0)} units</span></div>
          <form className="ipos-scan" onSubmit={(event) => { event.preventDefault(); submitScan(); }}>
            <label htmlFor="ipos-scan">Barcode / shop SKU {keyLabel('scan')}</label><div><Barcode size={21} aria-hidden="true" /><input id="ipos-scan" ref={scanInput} className="ops-input" autoComplete="off" spellCheck={false} placeholder="Scan or type a code" value={scan} disabled={!ownsCounter || busy || !!state.pending} onChange={(e) => setScan(e.target.value)} onKeyDown={(e) => { if (e.key === 'Tab' && state.settings.scannerSuffix === 'Tab' && scan.trim()) { e.preventDefault(); submitScan(); } }} /><button className="ops-button" type="submit" disabled={!ownsCounter || busy || !!state.pending}>{voidMode ? 'Find bill item' : 'Add item'}</button></div>
          </form>
          {lines.length ? classic ? <IPosClassicBill lines={lines} selectedId={selectedId} disabled={locked} showCodes={state.settings.showCodes} showStock={state.settings.showStock} onSelect={(id) => { setSelectedId(id); if (voidMode) requestVoid(id); }} onQuantity={openQuantity} onRemove={setRemoveId} /> : <div className="ipos-bill-lines"><div className="ipos-line-head" aria-hidden="true"><span>Item / description</span><span>Quantity</span><span>Amount</span></div><ul>{lines.map(({ product, quantity }) => <li className="ipos-line" key={product.merchantProductId}>
            <div><strong>{product.name}</strong><small>{money(product.pricePaisa)} / {product.unit}</small>{state.settings.showCodes && <small className="ipos-code">{product.barcode || product.merchantSku || 'No code assigned'}</small>}{quantity > product.stockQuantity && <small className="ipos-inline-error">Only {product.stockQuantity} available. Reduce quantity.</small>}</div>
            <div className="ipos-quantity"><button className="ops-button" disabled={locked} aria-label={`Decrease quantity of ${product.name}`} onClick={() => { if (quantity === 1) { setRemoveId(product.merchantProductId); return; } commit({ ...state, draft: { ...state.draft, lines: lines.map((line) => line.product.merchantProductId === product.merchantProductId ? { ...line, quantity: quantity - 1 } : line) } }); }}>−</button><span aria-label={`${quantity} units`}>{quantity}</span><button className="ops-button" disabled={locked} aria-label={`Increase quantity of ${product.name}`} onClick={() => {
              try { const next = addProduct(lines, product); commit({ ...state, draft: { ...state.draft, lines: next } }); } catch (cause) { setError(errorMessage(cause)); }
            }}>+</button></div><div className="ipos-line-total"><strong>{money(product.pricePaisa * quantity)}</strong><button className="ops-button ipos-remove" disabled={locked} aria-label={`Remove ${product.name}`} onClick={() => setRemoveId(product.merchantProductId)}><Trash2 size={15} aria-hidden="true" /></button></div>
          </li>)}</ul></div> : <div className="ipos-empty"><ShoppingBasket size={36} aria-hidden="true" /><h3>Ready for the next customer</h3><p>Scan an item or select a product from your shop’s catalogue.</p><button className="ops-button" disabled={locked} onClick={() => scanInput.current?.focus()}>Start scanning</button></div>}
          <div className="ipos-commandbar"><button className="ops-button" disabled={locked} onClick={hold}><Pause size={16} aria-hidden="true" />Hold bill {keyLabel('hold')}</button><button className="ops-button" disabled={locked || !lines.length} onClick={() => void refreshBill()}><RefreshCw size={16} aria-hidden="true" />Refresh prices</button><button className="ops-button ops-button-danger" disabled={locked || !lines.length} onClick={() => setDialog('discard')}><Trash2 size={16} aria-hidden="true" />Discard bill</button></div>
          <div className="ipos-totals"><div><span>Total payable</span><strong>{money(subtotal)}</strong><small>Cash only · no additional tax calculated</small></div><button className="ops-button ops-button-primary" disabled={locked || !online} onClick={pay}><Wallet size={19} aria-hidden="true" />Take payment {keyLabel('payment')}</button></div>
        </section>
        <div className="ipos-side-panel"><section className="ipos-command-panel" aria-label="Counter actions"><h2>Counter actions</h2><div className="ipos-command-grid">{currentCommands.filter((command) => command.id !== 'payment').map((command) => <button key={command.id} className={`ops-button${command.id === 'reset' || command.id === 'void' ? ' ops-button-danger' : ''}`} disabled={locked} aria-pressed={command.id === 'void' ? voidMode : undefined} onClick={() => runCommand(command.id)}>{command.action}{keyLabel(command.id)}</button>)}</div></section>
        <section className="ipos-catalogue" aria-label="Shop catalogue"><div className="ipos-section-heading"><h2>Shop catalogue</h2><Link to="/products" className="ipos-text-link">Manage products</Link></div><label className="ipos-field" htmlFor="ipos-search">Find a product {keyLabel('search')}<div className="ipos-search"><Search size={18} aria-hidden="true" /><input id="ipos-search" ref={searchInput} className="ops-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, barcode or SKU" /></div></label>
          {loading ? <p className="ipos-muted" role="status">Loading products…</p> : catalogueError ? <div className="ipos-error" role="alert">{catalogueError}<button className="ops-button" onClick={() => setRefresh((v) => v + 1)}>Retry catalogue</button></div> : !products.length ? <div className="ipos-empty"><h3>{query ? 'No matching products' : 'No products in this shop'}</h3><p>{query ? `No results for “${query}”. Try fewer words or check the code.` : 'Add stock in Products before starting a counter sale.'}</p>{query ? <button className="ops-button" onClick={() => setQuery('')}>Clear search</button> : <Link className="ops-button" to="/products">Open Products</Link>}</div> : <div className="ipos-products">{products.map((product) => <button className="ipos-product" key={product.merchantProductId} disabled={locked || (!voidMode && (!product.isAvailable || product.stockQuantity < 1))} onClick={() => selectProduct(product)}><div><strong>{product.name}</strong><small>{product.unit}{state.settings.showCodes && (product.barcode || product.merchantSku) ? ` · ${product.barcode || product.merchantSku}` : ''}</small></div><span>{money(product.pricePaisa)}</span><small>{voidMode ? 'Find on unpaid bill' : !product.isAvailable ? 'Unavailable' : product.stockQuantity < 1 ? 'Out of stock' : state.settings.showStock ? `${product.stockQuantity} in stock` : 'Add to bill'}</small><Plus size={17} aria-hidden="true" /></button>)}</div>}
          <p className="ipos-muted">Up to 300 matches shown. Exact barcode lookup searches beyond this list.</p>
        </section></div>
      </div><div className="ipos-footer-note">Drafts are saved in this browser. Complete sales require a server connection.{state.lastReceipt && <button className="ipos-text-link" onClick={() => setReceipt(state.lastReceipt)}>Open last receipt</button>}</div>
    </>}

    {view === 'held' && <section className="ipos-panel"><div className="ipos-section-heading"><h2>Held bills</h2><span className="ipos-chip">This browser · this cashier</span></div><p className="ipos-muted">Recall a bill to review current prices and stock before payment. Held bills do not reserve inventory.</p>{!state.held.length ? <div className="ipos-empty"><Pause size={32} aria-hidden="true" /><h3>No held bills</h3><p>Use Hold bill on the register to serve another customer first.</p><button className="ops-button" onClick={() => changeView('register')}>Go to register</button></div> : <ul className="ipos-held-list">{state.held.map((held) => <li key={held.id}><div><strong>{held.lines.map((line) => line.product.name).join(', ')}</strong><p>{new Date(held.createdAt).toLocaleString('en-PK')} · {held.lines.length} {held.lines.length === 1 ? 'line' : 'lines'}</p></div><strong>{money(total(held.lines))}</strong><button className="ops-button" disabled={locked} onClick={() => { if (lines.length) { setError('Hold or discard the current bill before recalling another.'); return; } if (commit({ ...state, draft: held, held: state.held.filter((item) => item.id !== held.id) })) { setView('register'); setNotice('Bill recalled. Refresh prices and check stock before payment.'); } }}>Recall bill</button></li>)}</ul>}</section>}

    {view === 'sales' && <section className="ipos-panel"><div className="ipos-section-heading"><h2>Sales history</h2><div className="ipos-actions"><label className="ipos-field">Period<select className="ops-input" value={dateRange} onChange={(e) => setDateRange(e.target.value)}><option value="today">Today</option><option value="week">Last 7 days</option></select></label><button className="ops-button" onClick={() => setRefresh((v) => v + 1)}>Refresh sales</button></div></div><p className="ipos-muted">Latest 200 shop POS receipts in the selected period. This is not a shift-closing or cash reconciliation report.</p>{salesLoading ? <p role="status">Loading sales…</p> : salesError ? <p className="ipos-error" role="alert">{salesError}</p> : !sales.length ? <div className="ipos-empty"><History size={32} aria-hidden="true" /><h3>No sales in this period</h3><p>Completed counter sales appear here. Try the last 7 days or start a new bill.</p></div> : <ul className="ipos-sales-list">{sales.map((sale) => <li key={sale.id}><div><strong>{sale.orderNumber}</strong><p>{new Date(sale.createdAt).toLocaleString('en-PK')}</p></div><strong>{money(sale.totalAmountPaisa)}</strong><button className="ops-button" disabled={busy} onClick={() => void openReceipt(sale.id)}><Printer size={16} aria-hidden="true" />Open receipt</button></li>)}</ul>}</section>}

    {view === 'settings' && <IPosSettings settings={state.settings} disabled={locked} cashier={cashier} isOwner={profile.isOwner} onDirty={markSettingsDirty} onSave={(settings) => commit({ ...state, settings })} />}

    {dialog === 'payment' && <Modal title="Cash payment" onClose={() => { if (!busy) setDialog(null); }}><div className="ipos-payment"><p>Total payable<strong>{money(subtotal)}</strong></p><label className="ipos-field" htmlFor="ipos-cash">Cash received<input id="ipos-cash" ref={cashInput} className="ops-input" inputMode="decimal" autoComplete="off" value={cash} onChange={(e) => setCash(e.target.value)} disabled={busy || !!state.pending} aria-describedby="ipos-cash-help ipos-cash-error" /></label><small id="ipos-cash-help">Scan items before opening payment. Confirm the cash received manually.</small>{paymentFieldError && <p id="ipos-cash-error" className="ipos-inline-error" role="alert">{error}</p>}<div className="ipos-actions">{[subtotal, ...[50000, 100000, 500000].filter((v) => v > subtotal)].map((value) => <button className="ops-button" key={value} disabled={busy || !!state.pending} onClick={() => setCash((value / 100).toFixed(2))}>{money(value)}</button>)}</div><p>Change due<strong>{amount !== null && amount >= subtotal ? money(amount - subtotal) : 'Enter cash received'}</strong></p><button type="button" className="ops-button ops-button-primary" disabled={busy || !!state.pending || !ownsCounter} onClick={() => {
      try { const payload = paymentPayload(state.draft, state.settings, cash); if (commit({ ...state, pending: payload })) void sendSale(payload); }
      catch (cause) { setError(errorMessage(cause)); cashInput.current?.focus(); }
    }}>{busy ? 'Saving sale…' : 'Complete cash sale'}</button><p className="ipos-muted">Only select this after collecting cash. Printing will not create another sale.</p>{state.pending && !busy && <button className="ops-button" onClick={() => setDialog(null)}>Close and check saved sale</button>}</div></Modal>}
    {dialog === 'discard' && <Modal title="Discard this unpaid bill?" onClose={() => setDialog(null)}><p>The current {lines.length} bill lines will be removed. Hold the bill instead if the customer will return.</p><div className="ipos-actions"><button className="ops-button" onClick={() => setDialog(null)}>Keep bill</button><button className="ops-button ops-button-danger" onClick={() => { if (!locked && commit({ ...state, draft: ticket() })) { resetEntry(); setDialog(null); setNotice('Unpaid bill discarded.'); } }}>Discard unpaid bill</button></div></Modal>}
    {removeId && <Modal title="Remove this bill item?" onClose={() => setRemoveId(null)}><p>{lines.find((line) => line.product.merchantProductId === removeId)?.product.name}</p><div className="ipos-actions"><button className="ops-button" onClick={() => setRemoveId(null)}>Keep item</button><button className="ops-button ops-button-danger" onClick={() => { if (!locked && commit({ ...state, draft: { ...state.draft, lines: lines.filter((line) => line.product.merchantProductId !== removeId) } })) setRemoveId(null); }}>Remove item</button></div></Modal>}
    {voidId && <Modal title="Void one unpaid unit?" onClose={() => setVoidId(null)}><p>Remove one unit of {lines.find((line) => line.product.merchantProductId === voidId)?.product.name} from this bill? This does not refund a completed sale.</p><div className="ipos-actions"><button className="ops-button" onClick={() => setVoidId(null)}>Keep unit</button><button className="ops-button ops-button-danger" disabled={locked} onClick={() => { try { if (commit({ ...state, draft: { ...state.draft, lines: voidUnit(lines, voidId) } })) { setVoidId(null); setNotice('One unpaid unit voided. Void mode is still active.'); } } catch (cause) { setError(errorMessage(cause)); } }}>Void one unit</button></div></Modal>}
    {(dialog === 'quantity' || dialog === 'multi') && <Modal title={dialog === 'quantity' ? 'Change bill quantity' : 'Set next addition quantity'} onClose={() => setDialog(null)}><form onSubmit={(event) => {
      event.preventDefault(); if (locked) return;
      try {
        if (!/^\d+$/.test(quantityText)) throw Error('Enter a whole quantity from 1 to 100000.');
        const value = Number(quantityText);
        if (!Number.isSafeInteger(value) || value < 1 || value > 100000) throw Error('Enter a whole quantity from 1 to 100000.');
        if (dialog === 'quantity') { if (!commit({ ...state, draft: { ...state.draft, lines: setLineQuantity(lines, selectedId, value) } })) return; }
        else { setVoidMode(false); setNextQuantity(value); }
        setDialog(null); setNotice(dialog === 'quantity' ? 'Bill quantity updated.' : `Next successful addition will use ${value} units.`);
      } catch (cause) { setQuantityError(errorMessage(cause)); }
    }}>
      {dialog === 'quantity' && <label className="ipos-field">Bill item<select className="ops-input" value={selectedId} onChange={(e) => { setSelectedId(e.target.value); setQuantityText(String(lines.find((line) => line.product.merchantProductId === e.target.value)?.quantity ?? 1)); setQuantityError(''); }}>{lines.map((line) => <option key={line.product.merchantProductId} value={line.product.merchantProductId}>{line.product.name}</option>)}</select></label>}
      <label className="ipos-field">Whole-unit quantity<input className="ops-input" inputMode="numeric" value={quantityText} aria-invalid={!!quantityError} aria-describedby="ipos-quantity-error" onChange={(e) => { setQuantityText(e.target.value); setQuantityError(''); }} /></label>
      <p id="ipos-quantity-error" role="status">{quantityError}</p><p className="ipos-muted">Packaged units only. Stock is checked before addition and again when saving the sale.</p><div className="ipos-actions"><button type="button" className="ops-button" onClick={() => setDialog(null)}>Cancel</button><button type="submit" className="ops-button ops-button-primary" disabled={locked}>Apply quantity</button></div>
    </form></Modal>}
    {dialog === 'exit' && <Modal title="Leave the counter?" onClose={() => setDialog(null)}><p>Your unpaid draft and held bills stay in this browser. This returns to the dashboard; it does not sign out or close the browser.</p><div className="ipos-actions"><button className="ops-button" onClick={() => setDialog(null)}>Stay at counter</button><button className="ops-button" disabled={locked} onClick={() => { if (commit(state)) navigate('/'); }}>Leave counter</button></div></Modal>}
    {dialog === 'help' && <Modal title="Counter commands" onClose={() => setDialog(null)}><p className="ipos-muted">{shortcutProfiles.find((profile) => profile.id === state.settings.shortcutProfile)?.label}. {state.settings.shortcuts ? 'Keys run only on the register with no dialog open.' : 'Keyboard shortcuts are disabled.'} Browser/system shortcuts can take priority. Use the visible buttons if a key is intercepted.</p><dl className="ipos-shortcuts">{currentCommands.map((command) => <div key={command.id}><dt><kbd>{state.settings.shortcuts ? command.key || 'Button only' : 'Keys off'}</kbd> {command.action}</dt><dd>{command.detail}</dd></div>)}</dl><div className="ipos-notice"><strong>Not yet available</strong><p>F6 Refund, cashier discounts, price overrides, shift closing, split payments, customer credit, scales and offline sales are not implemented. The reference profiles are partial, not full iPOS compatibility.</p></div></Modal>}
    {receipt && <Receipt sale={receipt} settings={state.settings} shopName={profile.shopName} onClose={() => setReceipt(null)} />}
    {toastNode}
  </div>;
}

function Receipt({ sale, settings, shopName, onClose }: { sale: PosSale; settings: CounterState['settings']; shopName: string; onClose: () => void }) {
  useEffect(() => { document.body.classList.add('ipos-receipt-open'); return () => document.body.classList.remove('ipos-receipt-open'); }, []);
  return <Modal title="Saved sale receipt" onClose={onClose}><article id="ipos-receipt" style={{ maxWidth: `${settings.paperWidth}mm` }}><div className="ipos-receipt-heading"><CheckCircle2 size={23} aria-hidden="true" /><h2>{sale.merchant?.shopName || shopName}</h2><p>{sale.merchant?.address}</p><p>{sale.orderNumber}</p><p>{new Date(sale.createdAt).toLocaleString('en-PK')}</p>{sale.counterName && <p>{sale.counterName}</p>}</div><ul>{sale.items.map((line, index) => <li key={index}><div><strong>{line.productNameSnapshot}</strong><small>{line.quantity} × {money(line.unitPricePaisa)}</small></div><span>{money(line.totalPricePaisa)}</span></li>)}</ul><div className="ipos-receipt-total"><span>Total</span><strong>{money(sale.totalAmountPaisa)}</strong></div>{sale.amountTenderedPaisa != null && <div className="ipos-receipt-total"><span>Cash received</span><span>{money(sale.amountTenderedPaisa)}</span></div>}{sale.changePaisa != null && <div className="ipos-receipt-total"><span>Change</span><span>{money(sale.changePaisa)}</span></div>}<p className="ipos-receipt-footer">{settings.receiptFooter}</p><small>Saved receipt copy · Cash · No fiscal approval recorded</small></article><div className="ipos-actions ipos-no-print"><button className="ops-button ops-button-primary" onClick={() => window.print()}><Printer size={17} aria-hidden="true" />Open print dialog</button><button className="ops-button" onClick={onClose}>Back to counter</button></div></Modal>;
}
