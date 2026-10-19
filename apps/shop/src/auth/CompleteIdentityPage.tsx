import { useState, type FormEvent } from 'react';
import { captureSession, getAccessToken, logout } from '../lib/api';
import { merchantApi } from './lib/api';
import './complete-identity.css';

export default function CompleteIdentityPage({ onComplete }: { onComplete: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || busy) return;
    const token = getAccessToken();
    if (!token) { setError('Your session has ended. Sign in again to finish shop setup.'); return; }
    setBusy(true);
    setError('');
    try {
      await merchantApi.uploadIdentity(file, token, captureSession());
      onComplete();
    } catch { setError('The ID-card image did not upload. Check your connection and try again.'); }
    finally { setBusy(false); }
  };

  return <main className="merchant-identity-recovery"><form className="panel" onSubmit={(event) => void submit(event)}>
    <h1>Finish your shop setup</h1>
    <p>Your shop details are saved. Upload a clear image of the owner’s CNIC to make your shop available to customers.</p>
    <label htmlFor="recovery-identity">CNIC image</label>
    <input id="recovery-identity" type="file" accept="image/jpeg,image/png,image/webp" required onChange={(event) => { setFile(event.target.files?.[0] ?? null); setError(''); }} />
    {error && <p role="alert" className="catalog-field-error">{error}</p>}
    <div className="merchant-identity-actions"><button className="btn primary" type="submit" disabled={busy || !file}>{busy ? 'Uploading…' : 'Upload and open my shop'}</button><button className="btn" type="button" onClick={() => void logout()}>Sign out</button></div>
  </form></main>;
}
