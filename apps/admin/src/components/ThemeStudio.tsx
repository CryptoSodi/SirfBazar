import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { contrast, deriveTheme, MAX_THEME_BYTES, normalizeHex, originalTheme, parseThemeJSON, presets, THEME_KEY, validateTheme, type SirfBazarTheme } from '../../../shared/design/theme';

type StudioContext = { open: () => void; theme: SirfBazarTheme };
const Context = createContext<StudioContext>({ open: () => {}, theme: originalTheme });
export const useThemeStudio = () => useContext(Context);
const reviewEnabled = import.meta.env.MODE !== 'production';

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<SirfBazarTheme>(originalTheme);
  const [systemDark, setSystemDark] = useState(false);
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(originalTheme.color);
  const [error, setError] = useState('');
  const [storageOK, setStorageOK] = useState(true);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const derived = useMemo(() => deriveTheme(theme, systemDark), [theme, systemDark]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(media.matches);
    update(); media.addEventListener('change', update);
    if (reviewEnabled) {
      try { const raw = localStorage.getItem(THEME_KEY); if (raw) { const saved = parseThemeJSON(raw); setTheme(saved); setHex(saved.color); } }
      catch { try { localStorage.removeItem(THEME_KEY); } catch { setStorageOK(false); } }
    }
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.sbMode = derived.dark ? 'dark' : 'light';
    root.dataset.sbSidebar = theme.sidebar;
    root.dataset.sbDensity = theme.density;
    root.dataset.sbRadius = theme.radius;
    root.style.colorScheme = derived.dark ? 'dark' : 'light';
    for (const [key, value] of Object.entries(derived.tokens)) root.style.setProperty(key, value);
    if (reviewEnabled) {
      try { localStorage.setItem(THEME_KEY, JSON.stringify(theme)); setStorageOK(true); }
      catch { setStorageOK(false); }
    }
  }, [theme, derived]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !reviewEnabled) return;
    if (open && !dialog.open) {
      if (window.innerWidth <= 800) dialog.showModal(); else dialog.show();
      dialog.querySelector<HTMLButtonElement>('[data-close]')?.focus();
    } else if (!open && dialog.open) dialog.close();
  }, [open]);

  const close = () => { setOpen(false); window.setTimeout(() => triggerRef.current?.focus(), 0); };
  const show = () => { triggerRef.current = document.activeElement as HTMLElement; setOpen(true); };
  const change = (patch: Partial<SirfBazarTheme>) => {
    const next = validateTheme({ ...theme, ...patch });
    setTheme(next); setError('');
    if (patch.color) setHex(next.color);
  };
  const applyHex = () => {
    const value = normalizeHex(hex);
    if (!value) { setError('Enter a valid hex colour, such as #009966 or #06A.'); return; }
    change({ color: value });
  };
  const importJSON = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > MAX_THEME_BYTES) throw new Error('Theme file is larger than 32 KiB.');
      const next = parseThemeJSON(await file.text());
      setTheme(next); setHex(next.color); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to import theme.'); }
    if (fileRef.current) fileRef.current.value = '';
  };
  const exportCSS = () => download('sirfbazar-theme.css', `:root {\n${Object.entries(derived.tokens).map(([key, value]) => `  ${key}: ${value};`).join('\n')}\n}\n`, 'text/css');

  return (
    <Context.Provider value={{ open: show, theme }}>
      {children}
      {reviewEnabled && (
        <dialog ref={dialogRef} className="sb-theme-studio" aria-labelledby="sb-theme-title" onClose={() => setOpen(false)} onCancel={(e) => { e.preventDefault(); close(); }}>
          <div className="sb-theme-head"><div><div className="ops-kicker">Make it yours</div><h2 id="sb-theme-title">Theme Studio</h2><p>Preview this workspace without changing business data.</p></div><button type="button" data-close className="ops-button" aria-label="Close Theme Studio" onClick={close}>✕</button></div>
          <div className="sb-theme-body">
            <fieldset><legend>Appearance</legend><div className="ops-segment">{(['light', 'dark', 'system'] as const).map((value) => <button key={value} type="button" aria-pressed={theme.mode === value} onClick={() => change({ mode: value })}>{value}</button>)}</div></fieldset>
            <fieldset><legend>Accent colour</legend><div className="sb-theme-presets">{presets.map(([name, color]) => <button type="button" key={name} aria-label={`${name} ${color}`} aria-pressed={theme.color === color} onClick={() => change({ color })}><span style={{ background: color }} />{name}</button>)}</div>
              <div className="sb-theme-hex"><label htmlFor="sb-theme-color">Custom HEX</label><input id="sb-theme-color" value={hex} onChange={(e) => setHex(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') applyHex(); }} aria-invalid={!!error} aria-describedby="sb-theme-error" maxLength={7} /><input type="color" aria-label="Pick custom accent colour" value={theme.color} onChange={(e) => change({ color: e.target.value })} /><button type="button" className="ops-button" onClick={applyHex}>Apply</button></div>
              <p id="sb-theme-error" role="alert" className="sb-theme-error">{error}</p><p className="sb-theme-note">White text on the current action colour: {contrast(derived.tokens['--sb-action'], '#FFFFFF').toFixed(2)}:1.</p>
            </fieldset>
            <fieldset><legend>Workspace sidebar</legend><div className="ops-segment">{(['light', 'dark'] as const).map((value) => <button key={value} type="button" aria-pressed={theme.sidebar === value} onClick={() => change({ sidebar: value })}>{value === 'light' ? 'Match page' : 'Dark'}</button>)}</div></fieldset>
            <fieldset><legend>Table density</legend><div className="ops-segment">{(['comfortable', 'compact'] as const).map((value) => <button key={value} type="button" aria-pressed={theme.density === value} onClick={() => change({ density: value })}>{value}</button>)}</div></fieldset>
            <fieldset><legend>Corner style</legend><div className="ops-segment">{(['square', 'soft', 'rounded'] as const).map((value) => <button key={value} type="button" aria-pressed={theme.radius === value} onClick={() => change({ radius: value })}>{value === 'square' ? 'Precise' : value}</button>)}</div></fieldset>
            <label className="sb-theme-logo-choice"><span>Preview logo in accent colour<small>Original artwork is unchanged.</small></span><input type="checkbox" checked={theme.previewLogo} onChange={(e) => change({ previewLogo: e.target.checked })} /></label>
            <div className="sb-theme-preview">{theme.previewLogo ? <span className="sb-logo-mask" style={{ background: theme.color }} role="img" aria-label="SirfBazar logo in preview accent" /> : <img src="/brand/sirfbazar-horizontal-no-slogan.svg" alt="SirfBazar" />}<span className="ops-button ops-button-primary" aria-label="Sample action colour">Sample action</span></div>
            <div className="sb-theme-actions"><button type="button" className="ops-button" onClick={exportCSS}>Export CSS</button><button type="button" className="ops-button" onClick={() => download('sirfbazar-theme.json', `${JSON.stringify(theme, null, 2)}\n`, 'application/json')}>Export JSON</button><button type="button" className="ops-button" onClick={() => fileRef.current?.click()}>Import JSON</button><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => importJSON(e.target.files?.[0])} /></div>
            <button type="button" className="sb-theme-reset" onClick={() => { setTheme(originalTheme); setHex(originalTheme.color); setError(''); }}>Reset to SirfBazar original</button>
          </div>
          <div className="sb-theme-footer" role="status">{storageOK ? 'Saved in this browser' : 'Session only — storage unavailable'} · Review mode only</div>
        </dialog>
      )}
    </Context.Provider>
  );
}
