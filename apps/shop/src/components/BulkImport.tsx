import { ToastMessage } from './Toast';
import { useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { Modal, inputCls } from './ui';
import { CSV_FIELDS, guessCsvField, mapCsv, parseCsv, parseRupees, parseStock, parseXlsxBytes, productTemplateSheets, type BulkItem, type BulkMode, type CsvMapping, type PreviewResult, type TemplateCategory, type UploadResult } from '../lib/bulk-import';
import './bulk-import.css';

type Step = 'source' | 'mapping' | 'preview' | 'results';
const previousValues = (old?: Record<string, unknown>) => {
  if (!old || (typeof old.pricePaisa !== 'number' && typeof old.stockQuantity !== 'number')) return null;
  const discounted = typeof old.discountPricePaisa === 'number';
  const effectivePrice = discounted ? old.discountPricePaisa as number : old.pricePaisa as number;
  const price = typeof effectivePrice === 'number' ? `Rs ${(effectivePrice / 100).toFixed(2)}${discounted && typeof old.pricePaisa === 'number' ? ` discounted from Rs ${(old.pricePaisa / 100).toFixed(2)}` : ''}` : 'price unavailable';
  const stock = typeof old.stockQuantity === 'number' ? `${old.stockQuantity} units` : 'stock unavailable';
  return `Current: ${price} · ${stock}`;
};

export default function BulkImport({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [step, setStep] = useState<Step>('source');
  const [source, setSource] = useState('');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<CsvMapping>({});
  const [mode, setMode] = useState<BulkMode>('ADD_MISSING');
  const [items, setItems] = useState<BulkItem[]>([]);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [corrections, setCorrections] = useState<Record<string, { price: string; stock: string }>>({});
  const [requestId, setRequestId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const prepareRows = (parsed: string[][]) => {
    const proposed: CsvMapping = {};
    parsed[0].forEach((heading, index) => {
      const key = guessCsvField(heading);
      if (key && proposed[key] === undefined) proposed[key] = index;
    });
    setRows(parsed);
    setMapping(proposed);
    setError('');
    setStep('mapping');
  };

  const readFile = async (file?: File) => {
    if (!file) return;
    if (!/\.(csv|xlsx)$/i.test(file.name)) { setError('Choose a CSV or XLSX product file.'); return; }
    if (file.size > 2 * 1024 * 1024) { setError('File is over 2 MiB. Split it into smaller files.'); return; }
    try {
      const parsed = /\.xlsx$/i.test(file.name)
        ? parseXlsxBytes(await file.arrayBuffer(), await import('xlsx'))
        : parseCsv(await file.text());
      setSource('');
      setFileName(file.name);
      prepareRows(parsed);
    } catch (cause) { setError(errorMessage(cause) || 'Unable to read the file. Choose a CSV or XLSX file and try again.'); }
  };
  const mapSource = () => {
    try {
      prepareRows(parseCsv(source));
    } catch (cause) { setError(errorMessage(cause)); }
  };
  const downloadCsvTemplate = () => {
    const blob = new Blob([`\uFEFF${CSV_FIELDS.map(({ label }) => `"${label.replace(/"/g, '""')}"`).join(',')}\r\n`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sirfbazar-product-import-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };
  const downloadXlsxTemplate = async () => {
    try {
      setBusy(true); setError('');
      const categories = await api.get('/products/categories') as TemplateCategory[];
      if (!Array.isArray(categories) || categories.length === 0) throw Error('Categories are unavailable. Try downloading the Excel template again.');
      const { utils, writeFileXLSX } = await import('xlsx');
      const template = productTemplateSheets(categories);
      const sheet = utils.aoa_to_sheet(template.products);
      sheet['!cols'] = CSV_FIELDS.map(({ label }) => ({ wch: Math.max(18, label.length + 2) }));
      const workbook = utils.book_new();
      utils.book_append_sheet(workbook, sheet, 'Products');
      const guide = utils.aoa_to_sheet(template.guide);
      guide['!cols'] = [{ wch: 28 }, { wch: 95 }];
      utils.book_append_sheet(workbook, guide, 'How to fill it in');
      const categorySheet = utils.aoa_to_sheet(template.categories);
      categorySheet['!cols'] = [{ wch: 56 }, { wch: 42 }];
      utils.book_append_sheet(workbook, categorySheet, 'Categories');
      writeFileXLSX(workbook, 'sirfbazar-product-import-template.xlsx');
    } catch (cause) { setError(errorMessage(cause) || 'Unable to create the XLSX template.'); }
    finally { setBusy(false); }
  };
  const review = async () => {
    try {
      const mapped = mapCsv(rows, mapping);
      setBusy(true); setError(''); setResult(null);
      const id = crypto.randomUUID();
      const next = await api.post('/merchant/products/bulk-preview', { requestId: id, mode, items: mapped }) as PreviewResult;
      if (!Array.isArray(next.rows) || !next.previewToken) throw Error('Preview response was incomplete. Try again.');
      setItems(mapped); setPreview(next); setRequestId(id); setStep('preview');
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  };
  const commit = async () => {
    if (!preview || !requestId) return;
    try {
      setBusy(true); setError('');
      const next = await api.post('/merchant/products/bulk-upload', { requestId, mode, items, previewToken: preview.previewToken }) as UploadResult;
      if (!Array.isArray(next.rows)) throw Error('The upload response was incomplete. Retry the same request to reconcile it.');
      setResult(next); setStep('results');
      setCorrections(Object.fromEntries(next.rows.filter((row) => row.status === 'FAILED').map((row) => {
        const item = items.find((entry) => entry.rowId === row.rowId);
        return [row.rowId, { price: item ? (item.pricePaisa / 100).toFixed(2) : '', stock: item ? String(item.stockQuantity) : '' }];
      })));
      if (next.created || next.updated) onSaved();
    } catch (cause) { setError(`${errorMessage(cause)} Retry this same request to check its result; successful rows will not be added again.`); }
    finally { setBusy(false); }
  };
  const reviewFailed = async () => {
    if (!result) return;
    try {
      const failed = new Set(result.rows.filter((row) => row.status === 'FAILED').map((row) => row.rowId));
      const corrected = items.filter((item) => failed.has(item.rowId)).map((item) => ({ ...item, pricePaisa: parseRupees(corrections[item.rowId]?.price ?? ''), stockQuantity: parseStock(corrections[item.rowId]?.stock ?? '') }));
      if (!corrected.length) throw Error('No failed rows are available to preview.');
      setBusy(true); setError('');
      const id = crypto.randomUUID();
      const next = await api.post('/merchant/products/bulk-preview', { requestId: id, mode, items: corrected }) as PreviewResult;
      if (!Array.isArray(next.rows) || !next.previewToken) throw Error('Preview response was incomplete. Try again.');
      setItems(corrected); setRequestId(id); setPreview(next); setResult(null); setStep('preview');
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  };
  const counts = preview?.rows.reduce((value, row) => ({ ...value, [row.status]: value[row.status] + 1 }), { NEW: 0, MATCH: 0, SKIP: 0, CONFLICT: 0 }) ?? { NEW: 0, MATCH: 0, SKIP: 0, CONFLICT: 0 };
  const canCommit = !!preview && counts.CONFLICT === 0 && counts.NEW + counts.MATCH > 0;

  return <Modal title="Import products" onClose={onClose}><div className="bulk-import">
    <p className="muted">Import CSV or XLSX product sheets. Review the column mapping and server preview before any changes are saved.</p>
    <div className="bulk-steps" aria-label="Import progress">{['Source', 'Map columns', 'Preview', 'Results'].map((label, index) => <span key={label} aria-current={['source', 'mapping', 'preview', 'results'][index] === step ? 'step' : undefined}>{index + 1}. {label}</span>)}</div>
    {error && <ToastMessage>{error}</ToastMessage>}
    {step === 'source' && <>
      <div className="bulk-template-option">
        <div><strong>Start with a blank Excel sheet</strong><span>Download the template, add one product per row, then upload the completed file below. It includes filling instructions and your current category IDs.</span></div>
        <button type="button" className="btn primary" disabled={busy} onClick={() => void downloadXlsxTemplate()}>{busy ? 'Preparing template…' : 'Download Excel template'}</button>
      </div>
      <div className="bulk-file-option">
        <label htmlFor="bulk-import-file"><strong>Upload your completed sheet</strong><span>Select an XLSX or CSV file, then review its columns before importing.</span></label>
        <input id="bulk-import-file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void readFile(file); }} />
        <small>Maximum 2 MiB or 1,000 products. No products are saved until you confirm the preview.</small>
      </div>
      <p className="muted">For new products, fill in name, category ID, unit, sale price and stock quantity. Keep SKU or barcode codes as text to preserve leading zeros.</p>
      <button type="button" className="btn" onClick={downloadCsvTemplate}>Download CSV template instead</button>
      <details className="bulk-paste-option"><summary>Paste CSV instead</summary><label className="bulk-field" htmlFor="bulk-import-paste">CSV text<textarea id="bulk-import-paste" className={inputCls} rows={8} value={source} onChange={(event) => { setSource(event.target.value); setFileName(''); }} placeholder={'Product name,Sale price,Stock quantity\nBasmati Rice,650.00,20'} /></label><button type="button" className="btn" disabled={!source.trim()} onClick={mapSource}>Map pasted columns</button></details>
    </>}
    {step === 'mapping' && <><p>{fileName ? `Source: ${fileName}. ` : ''}Match the report’s columns. Select sale price and stock quantity, not cost or stock value. Codes are kept as text, including leading zeros.</p><div className="bulk-mapping">{CSV_FIELDS.map(({ key, label }) => <label key={key} className="bulk-field">{label}<select className={inputCls} value={mapping[key] ?? ''} onChange={(event) => setMapping((current) => ({ ...current, [key]: event.target.value === '' ? undefined : Number(event.target.value) }))}><option value="">Do not import</option>{rows[0]?.map((header, index) => <option key={index} value={index}>{header || `Column ${index + 1}`}</option>)}</select></label>)}</div><fieldset className="bulk-mode"><legend>Existing listings</legend><label><input type="radio" name="bulk-mode" checked={mode === 'ADD_MISSING'} onChange={() => setMode('ADD_MISSING')} /> Add missing products only</label><label><input type="radio" name="bulk-mode" checked={mode === 'UPDATE_EXISTING'} onChange={() => setMode('UPDATE_EXISTING')} /> Replace existing sale price and stock; clear existing discounts</label></fieldset><div className="row"><button className="btn" onClick={() => setStep('source')}>Back to file</button><button className="btn primary" disabled={busy} onClick={() => void review()}>{busy ? 'Checking…' : 'Preview changes'}</button></div></>}
    {step === 'preview' && preview && <><p role="status">{counts.NEW} new · {counts.MATCH} matched · {counts.SKIP} skipped · {counts.CONFLICT} conflicts. {mode === 'ADD_MISSING' ? 'Existing listings will be skipped.' : 'Matched listings will receive the CSV sale price and stock; existing discounts will be cleared after confirmation.'}</p><div className="bulk-preview-list">{preview.rows.map((row) => { const item = items.find((entry) => entry.rowId === row.rowId); return <article key={row.rowId} className="bulk-preview-row"><strong>Row {row.rowId}: {item?.name || item?.merchantSku || item?.productId || 'Product'}</strong><span>{row.status}</span><p>New: {item ? `Rs ${(item.pricePaisa / 100).toFixed(2)} · ${item.stockQuantity} units` : '—'}</p>{previousValues(row.old) && <p>{previousValues(row.old)}</p>}{row.error && <p className="inline-error">{row.error}</p>}</article>; })}</div><div className="row"><button className="btn" onClick={() => setStep('mapping')}>Change mapping</button><button className="btn primary" disabled={busy || !canCommit} onClick={() => void commit()}>{busy ? 'Importing…' : mode === 'UPDATE_EXISTING' ? 'Confirm price, stock and discount replacement' : 'Confirm import'}</button></div>{counts.CONFLICT > 0 && <p className="inline-error">Resolve conflicting rows in the CSV, then preview again.</p>}</>}
    {step === 'results' && result && <><p role="status">{result.created} created · {result.updated} updated · {result.skipped} skipped · {result.failed.length} failed.</p><div className="bulk-preview-list">{result.rows.map((row) => <div key={row.rowId} className="bulk-preview-row"><p>Row {row.rowId}: {row.status}{row.error ? ` — ${row.error}` : ''}</p>{row.status === 'FAILED' && <div className="bulk-mapping"><label className="bulk-field">Sale price (Rs)<input className={inputCls} inputMode="decimal" value={corrections[row.rowId]?.price ?? ''} onChange={(event) => setCorrections((current) => ({ ...current, [row.rowId]: { ...current[row.rowId], price: event.target.value } }))} /></label><label className="bulk-field">Stock quantity (units)<input className={inputCls} inputMode="numeric" value={corrections[row.rowId]?.stock ?? ''} onChange={(event) => setCorrections((current) => ({ ...current, [row.rowId]: { ...current[row.rowId], stock: event.target.value } }))} /></label></div>}</div>)}</div><div className="row"><button className="btn" onClick={onClose}>Done</button>{result.failed.length > 0 && <><button className="btn" disabled={busy} onClick={() => void commit()}>Retry same import</button><button className="btn primary" disabled={busy} onClick={() => void reviewFailed()}>Preview corrected failed rows</button></>}</div>{result.failed.length > 0 && <p className="muted">For identity or category errors, correct the CSV and start a new import with failed rows only.</p>}</>}
  </div></Modal>;
}
