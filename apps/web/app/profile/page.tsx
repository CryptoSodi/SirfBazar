'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, isLoggedIn, logoutLocal } from '@/lib/api';
import { formatPKR } from '@/lib/format';
import { LoginSheet } from '@/components/LoginSheet';
import { AddressForm } from '@/components/AddressForm';

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [needLogin, setNeedLogin] = useState(false);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<any | 'new' | null>(null);

  const load = () => {
    if (!isLoggedIn()) {
      setNeedLogin(true);
      return;
    }
    setNeedLogin(false);
    api.get('/customer/profile').then((p) => {
      setProfile(p);
      setName(p.fullName ?? '');
    }).catch(() => undefined);
    api.get('/customer/addresses').then(setAddresses).catch(() => undefined);
  };

  useEffect(load, []);

  if (needLogin) {
    return <LoginSheet title="Login to your account" onClose={() => router.push('/')} onSuccess={load} />;
  }
  if (!profile) return <p className="text-stone-500">Loading profile…</p>;

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
      <h1 className="text-xl font-bold">Your account</h1>

      <section className="card p-5">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-xl font-black text-emerald-700">
            {(profile.fullName ?? 'C').slice(0, 1).toUpperCase()}
          </span>
          <div>
            <div className="font-bold">{profile.fullName ?? 'Customer'}</div>
            <div className="text-sm text-stone-500">{profile.phoneNumber ?? profile.email}</div>
            <div className="mt-1 text-xs text-emerald-700">
              👛 Wallet: {formatPKR(profile.customer?.walletBalancePaisa ?? 0)}
            </div>
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
                    {a.instructions && <div className="text-xs text-stone-400">📝 {a.instructions}</div>}
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

      <section className="card p-5">
        <h2 className="mb-3 font-bold">Quick links</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link className="btn-secondary" href="/orders">📦 My orders</Link>
          <Link className="btn-secondary" href="/cart">🛒 Cart</Link>
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
