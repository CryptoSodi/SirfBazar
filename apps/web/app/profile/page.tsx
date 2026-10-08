'use client';

import { AppIcon } from '@/components/AppIcon';
import { AppIcon as UiIcon } from '../../components/AppIcon';


import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError, api, isLoggedIn, logoutLocal } from '@/lib/api';
import { LoginSheet } from '@/components/LoginSheet';
import { AddressForm } from '@/components/AddressForm';
import { GoogleAccountLink } from '@/components/GoogleAccountLink';

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [needLogin, setNeedLogin] = useState(false);
  const [name, setName] = useState('');
  const [appearance, setAppearance] = useState<'light' | 'dark' | 'system'>('system');
  const [editing, setEditing] = useState<any | 'new' | null>(null);
  const [loadError, setLoadError] = useState('');
  const [addressError, setAddressError] = useState('');
  const [signInMessage, setSignInMessage] = useState('');

  const recoverFromWrongRole = (error: Error) => {
    if (!(error instanceof ApiError) || error.status !== 403) return false;
    logoutLocal();
    setProfile(null);
    setAddresses([]);
    setSignInMessage('Your session needs updating. Sign in again to view your customer profile.');
    setNeedLogin(true);
    return true;
  };

  const load = () => {
    if (!isLoggedIn()) {
      setNeedLogin(true);
      setProfile(null);
      setLoadError('');
      setAddressError('');
      return;
    }
    setNeedLogin(false);
    setLoadError('');
    setAddressError('');
    api.get('/customer/profile').then((p) => {
      setProfile(p);
      setName(p.fullName ?? '');
    }).catch((e: Error) => {
      if (!isLoggedIn()) { setProfile(null); setNeedLogin(true); }
      else if (recoverFromWrongRole(e)) return;
      else setLoadError(e.message);
    });
    api.get('/customer/addresses').then(setAddresses).catch((e: Error) => {
      if (!isLoggedIn()) { setProfile(null); setNeedLogin(true); }
      else if (recoverFromWrongRole(e)) return;
      else setAddressError(e.message);
    });
  };

  useEffect(load, []);
  useEffect(() => {
    const stored = localStorage.getItem('sb.theme');
    setAppearance(stored === 'light' || stored === 'dark' ? stored : 'system');
  }, []);

  const chooseAppearance = (value: 'light' | 'dark' | 'system') => {
    localStorage.setItem('sb.theme', value);
    setAppearance(value);
    window.dispatchEvent(new Event('sb:theme'));
  };

  if (needLogin) {
    return <LoginSheet title="Sign in to your customer account" description={signInMessage || 'Sign in to view your profile and saved addresses.'} onClose={() => router.push('/')} onSuccess={() => { setSignInMessage(''); load(); }} />;
  }
  if (loadError && !profile) return <div role="alert" className="card p-5"><p>Unable to load your profile: {loadError}</p><button className="btn-secondary mt-3" onClick={load}>Retry</button></div>;
  if (!profile) return <p role="status" className="text-stone-500">Loading profile…</p>;

  const saveName = async () => {
    try {
      await api.put('/customer/profile', { fullName: name });
      alert('Saved');
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {addressError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">Unable to load saved addresses: {addressError} <button className="underline" onClick={load}>Retry</button></p>}
      <h1 className="text-xl font-bold">Your account</h1>
      <GoogleAccountLink />

      <section className="card p-5">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-xl font-black text-emerald-700">
            {(profile.fullName ?? 'C').slice(0, 1).toUpperCase()}
          </span>
          <div>
            <div className="font-bold">{profile.fullName ?? 'Customer'}</div>
            <div className="text-sm text-stone-500">{profile.phoneNumber ?? profile.email}</div>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          <button className="btn-secondary" onClick={saveName}>Save</button>
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">Saved addresses</h2>
          {editing !== 'new' && (
            <button className="btn-secondary text-sm" onClick={() => setEditing('new')}>+ Add address</button>
          )}
        </div>

        {editing === 'new' && (
          <AddressForm onSaved={() => { setEditing(null); load(); }} onCancel={() => setEditing(null)} />
        )}

        <div className="mt-2 space-y-2">
          {addresses.map((a) => (
            <div key={a.id} className="rounded-xl border border-stone-200 p-3 text-sm">
              {editing && editing !== 'new' && editing.id === a.id ? (
                <AddressForm initial={a} onSaved={() => { setEditing(null); load(); }} onCancel={() => setEditing(null)} />
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <b>{a.label}</b> {a.isDefault && <span className="chip ml-1 bg-emerald-50 text-emerald-700">default</span>}
                    <div className="text-stone-500">{a.fullAddress}</div>
                    {a.instructions && <div className="text-xs text-stone-400"><UiIcon name="file" size={18} /> {a.instructions}</div>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                    <button className="text-emerald-700 underline" onClick={() => setEditing(a)}>edit</button>
                    {!a.isDefault && (
                      <button className="text-emerald-700 underline" onClick={async () => { await api.put(`/customer/addresses/${a.id}/default`); load(); }}>
                        make default
                      </button>
                    )}
                    <button
                      className="text-red-600 underline"
                      onClick={async () => {
                        if (confirm('Delete this address?')) {
                          try {
                            await api.del(`/customer/addresses/${a.id}`);
                            load();
                          } catch (e: any) {
                            alert(e.message);
                          }
                        }
                      }}
                    >
                      delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {addresses.length === 0 && editing !== 'new' && <p className="text-sm text-stone-500">No saved addresses yet.</p>}
        </div>
      </section>

      <section className="card p-5"><h2 className="mb-3 font-bold">Appearance</h2><div className="flex flex-wrap gap-2">{(['light', 'dark', 'system'] as const).map((option) => <button key={option} type="button" className={appearance === option ? 'sb-appearance-option selected' : 'sb-appearance-option'} aria-pressed={appearance === option} onClick={() => chooseAppearance(option)}><AppIcon name={option === 'light' ? 'sun' : option === 'dark' ? 'moon' : 'system'} size={18} /> {option[0].toUpperCase() + option.slice(1)}</button>)}</div><p className="sb-muted mt-3">System follows your device. Changing appearance keeps your basket.</p></section>

      <section className="card p-5">
        <h2 className="mb-3 font-bold">Quick links</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link className="btn-secondary" href="/orders"><UiIcon name="box" size={18} /> My orders</Link>
          <Link className="btn-secondary" href="/cart"><UiIcon name="cart" size={18} /> Cart</Link>
        </div>
      </section>

      <div className="flex justify-between">
        <button
          className="btn-secondary text-sm"
          onClick={() => {
            logoutLocal();
            router.push('/');
          }}
        >
          Log out
        </button>
        <button
          className="text-sm text-red-600 underline"
          onClick={async () => {
            if (confirm('Delete your account? Order history is retained for legal reasons but your login is disabled.')) {
              await api.del('/customer/account');
              logoutLocal();
              router.push('/');
            }
          }}
        >
          Delete account
        </button>
      </div>
    </div>
  );
}
