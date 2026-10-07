import { useEffect, useState } from 'react';
import { Barcode, CreditCard, Keyboard, Monitor, Printer, ShieldCheck, Wifi } from 'lucide-react';
import { activeCommands, bindingOptions, defaults, profileBindings, shortcutProfiles, validateBindings, type PosSettings, type ShortcutProfile } from '../lib/ipos';

const sections = [
  ['counter', 'Counter & billing', Monitor], ['scanner', 'Barcode scanner', Barcode],
  ['receipts', 'Receipts & printing', Printer], ['keys', 'Keyboard commands', Keyboard],
  ['payments', 'Payments & tax', CreditCard], ['access', 'Cashier & access', ShieldCheck],
  ['connection', 'Hardware & connection', Wifi],
] as const;

export default function IPosSettings({ settings, onSave, onDirty, disabled, cashier, isOwner }: {
  settings: PosSettings; onSave: (settings: PosSettings) => boolean; onDirty: (dirty: boolean) => void; disabled: boolean; cashier: string; isOwner: boolean;
}) {
  const [section, setSection] = useState<string>('counter');
  const [draft, setDraft] = useState(settings);
  const [message, setMessage] = useState('');
  const [testCode, setTestCode] = useState('');
  const [lastTest, setLastTest] = useState('');
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
  useEffect(() => { onDirty(dirty); return () => onDirty(false); }, [dirty, onDirty]);
  const field = <K extends keyof PosSettings>(key: K, value: PosSettings[K]) => { setDraft((s) => ({ ...s, [key]: value })); setMessage(''); };
  return <section className="ipos-settings" aria-label="POS settings">
    <nav className="ipos-settings-nav" aria-label="Settings sections">{sections.map(([id, label, Icon]) =>
      <button type="button" key={id} aria-pressed={section === id} onClick={() => setSection(id)}><Icon size={18} aria-hidden="true" />{label}</button>)}</nav>
    <div className="ipos-settings-panel">
      <div className="ipos-section-heading"><h2>{sections.find(([id]) => id === section)?.[1]}</h2><span className="ipos-chip">This browser only</span></div>
      <p className="ipos-muted">Preferences apply to this cashier and shop in this browser. They do not configure other counters or change server permissions.</p>
      <form onSubmit={(e) => { e.preventDefault(); if (disabled) return; if (!draft.counterName.trim()) { setMessage('Enter a counter name before saving.'); return; } const invalid = validateBindings(draft.bindings); if (invalid) { setMessage(invalid); setSection('keys'); return; } if (onSave({ ...draft, counterName: draft.counterName.trim() })) setMessage('Counter preferences saved.'); }}>
        <fieldset disabled={disabled} className="ipos-fieldset">
          {section === 'counter' && <>
            <label className="ipos-field">Counter appearance<select className="ops-input" value={draft.appearance} onChange={(e) => field('appearance', e.target.value as PosSettings['appearance'])}><option value="modern">Modern</option><option value="classic">Classic · legacy-style counter</option></select><small>Changes the layout only. Bills and the keyboard profile stay unchanged.</small></label>
            <label className="ipos-field">Counter name<input className="ops-input" name="counterName" value={draft.counterName} maxLength={60} required onChange={(e) => field('counterName', e.target.value)} /><small>Included on new sales and their saved receipt metadata.</small></label>
            <label className="ipos-check"><input type="checkbox" checked={draft.showStock} onChange={(e) => field('showStock', e.target.checked)} /><span>Show stock in the catalogue<small>Stock is still checked by the server when a sale is saved.</small></span></label>
            <label className="ipos-check"><input type="checkbox" checked={draft.mergeScans} onChange={(e) => field('mergeScans', e.target.checked)} /><span>Increase quantity on repeated scans<small>When off, use the quantity controls to add another unit of an existing item.</small></span></label>
            <div className="ipos-notice"><strong>Packaged units</strong><p>This counter sells whole units. Fractional weights, price overrides and cashier discounts are not enabled. Set selling prices in Products.</p></div>
          </>}
          {section === 'scanner' && <>
            <div className="ipos-notice"><strong>USB / Bluetooth keyboard mode</strong><p>Pair or connect the scanner through your device, then focus the register’s barcode field. Scans are looked up by exact barcode or shop SKU.</p></div>
            <label className="ipos-field">Scanner suffix<select className="ops-input" value={draft.scannerSuffix} onChange={(e) => field('scannerSuffix', e.target.value as PosSettings['scannerSuffix'])}><option value="Enter">Enter (recommended)</option><option value="Tab">Tab</option></select><small>Configure the same suffix on the scanner. Tab without a code still moves focus normally.</small></label>
            <label className="ipos-check"><input type="checkbox" checked={draft.showCodes} onChange={(e) => field('showCodes', e.target.checked)} /><span>Show barcode / SKU below product names</span></label>
            <label className="ipos-field">Test scanner input<input className="ops-input" autoComplete="off" spellCheck={false} placeholder="Scan a label here" value={testCode} onChange={(e) => setTestCode(e.target.value)} onKeyDown={(e) => {
              if (e.key === 'Enter' || (e.key === draft.scannerSuffix && testCode.trim())) { e.preventDefault(); if (testCode.trim()) { setLastTest(testCode); setTestCode(''); } }
            }} /><small>This test only displays the decoded text. It does not add a product or verify hardware compatibility.</small></label>
            <p className="ipos-code" role="status">{lastTest ? `Received: ${lastTest}` : 'Waiting for a test scan'}</p>
          </>}
          {section === 'receipts' && <>
            <label className="ipos-field">Receipt width<select className="ops-input" value={draft.paperWidth} onChange={(e) => field('paperWidth', e.target.value as PosSettings['paperWidth'])}><option value="80">80 mm</option><option value="58">58 mm</option></select><small>Select the matching paper in your operating system’s print dialog.</small></label>
            <label className="ipos-field">Receipt footer<textarea className="ops-input" rows={3} maxLength={160} value={draft.receiptFooter} onChange={(e) => field('receiptFooter', e.target.value)} /><small>Up to 160 characters. Receipt numbers and recorded amounts cannot be edited here.</small></label>
            <div className="ipos-notice"><strong>Browser printing</strong><p>Install your printer through the operating system. Use “Open print dialog” on a saved receipt. Silent printing, automatic cutting and cash-drawer pulses need a supported hardware adapter.</p></div>
          </>}
          {section === 'keys' && <>
            <label className="ipos-check"><input type="checkbox" checked={draft.shortcuts} onChange={(e) => field('shortcuts', e.target.checked)} /><span>Enable counter keyboard shortcuts<small>Active on the register only, with no dialog open. Browser/system keys may take priority.</small></span></label>
            <label className="ipos-field">Keyboard profile<select className="ops-input" value={draft.shortcutProfile} onChange={(e) => { const profile = e.target.value as ShortcutProfile; setDraft((s) => ({ ...s, shortcutProfile: profile, bindings: profile === 'custom' ? s.bindings : profileBindings(profile) })); setMessage(''); }}>{shortcutProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}</select><small>{shortcutProfiles.find((profile) => profile.id === draft.shortcutProfile)?.detail}</small></label>
            <div className="ipos-notice"><strong>References differ by edition</strong><p>The brochure shows two layouts with F2 and F4 swapped. Choose description-first or code-first to match your counter. Both show F11 Change quantity; video analysis identifies F11 Reset. Reference profiles are partial; unassigned commands still have buttons. F6 Refund remains unavailable in all reference profiles.</p><p>F5/F11/F12 may be captured while the register has focus; the browser or operating system can still take priority. Test on your counter keyboard. No key submits payment automatically.</p></div>
            <div className="ipos-key-editor">{activeCommands(draft).map((command) => <label className="ipos-field" key={command.id}>{command.action}<select className="ops-input" aria-label={`Shortcut for ${command.action}`} value={command.key} onChange={(e) => { setDraft((s) => ({ ...s, shortcutProfile: 'custom', bindings: { ...s.bindings, [command.id]: e.target.value } })); setMessage(''); }}>{bindingOptions.map((key) => <option key={key} value={key}>{key || 'Unassigned'}</option>)}</select><small>{command.detail}</small></label>)}</div>
            {validateBindings(draft.bindings) && <p className="ipos-error" role="alert">{validateBindings(draft.bindings)}</p>}
            <p className="ipos-muted">Alt-letter bindings are custom choices, not verified vendor mnemonics. They do not run inside text fields. Escape closes dialogs; Enter in the barcode field processes an item, never a payment.</p>
          </>}
          {section === 'payments' && <>
            <div className="ipos-setting-status"><strong>Cash</strong><span className="ipos-chip">Available</span><p>Explicit tender, calculated change and API-confirmed sale. A connection is required.</p></div>
            <div className="ipos-setting-status"><strong>Card, bank transfer & split payments</strong><span className="ipos-chip">Not connected</span><p>Provider confirmation and reconciliation must be implemented before these tenders can be accepted here.</p></div>
            <div className="ipos-setting-status"><strong>Tax / fiscal integration</strong><span className="ipos-chip">Not configured</span><p>No tax or fiscal approval is added by this counter. Confirm the shop’s requirements before using it for real trading. There is no fake fiscal number or payment confirmation.</p></div>
          </>}
          {section === 'access' && <>
            <dl className="ipos-details"><div><dt>Signed-in cashier</dt><dd>{cashier}</dd></div><div><dt>Account access</dt><dd>{isOwner ? 'Merchant owner' : 'Merchant staff · POS permission'}</dd></div><div><dt>Scope</dt><dd>This shop’s stock and POS sales only</dd></div></dl>
            <div className="ipos-notice"><strong>Access is enforced by the API</strong><p>Local preferences cannot grant discounts, refunds or permissions. A browser counter is not a substitute for a managed Windows/Android device lock.</p></div>
            <p className="ipos-muted">Sign out through the dashboard when leaving the counter. Drafts and held bills remain on this browser under your account. Clearing site data deletes them; saved server receipts remain available.</p>
          </>}
          {section === 'connection' && <>
            <div className="ipos-setting-status"><strong>Sale storage</strong><span className="ipos-chip">API required</span><p>Unpaid drafts can be retained locally. Completing offline sales and synchronizing independent counters are not enabled.</p></div>
            <div className="ipos-setting-status"><strong>Drawer, weighing scale & customer display</strong><span className="ipos-chip">Adapter required</span><p>These need model-specific integrations and physical tests. No device command is sent from this screen.</p></div>
            <div className="ipos-setting-status"><strong>Shift closing, refunds & purchasing</strong><span className="ipos-chip">Not enabled</span><p>Sales history is available, but it is not a cash-drawer reconciliation ledger. These workflows require their own audited server contracts.</p></div>
          </>}
        </fieldset>
        <div className="ipos-settings-footer"><button type="submit" className="ops-button ops-button-primary" disabled={disabled}>Save preferences{dirty ? ' *' : ''}</button><button type="button" className="ops-button" disabled={disabled} onClick={() => { setDraft({ ...defaults }); setMessage('Defaults loaded into the form. Save preferences to apply them.'); }}>Load defaults</button></div>
        <p className="ipos-muted" role="status">{message || (dirty ? 'Unsaved preferences. Save before leaving this settings view.' : 'No unsaved preferences.')}</p>
      </form>
    </div>
  </section>;
}
