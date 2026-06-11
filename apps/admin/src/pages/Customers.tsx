import { useState } from 'react';
import { api, pkr } from '../lib/api';
import { usePaged, Pager } from '../lib/usePaged';
import { Badge, Table, btnDanger, btnGhost, inputCls, useToast } from '../components/ui';

export default function Customers() {
  const [q, setQ] = useState('');
  const { items, page, setPage, totalPages, loading, error, reload } = usePaged('/admin/customers', { q });
  const { toast, node } = useToast();

  const act = async (id: string, action: 'suspend' | 'activate') => {
    try {
      await api.post(`/admin/customers/${id}/${action}`);
      toast(`Customer ${action}d`);
      reload();
    } catch (e: any) {
      toast(e.message, false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-xl font-bold">Customers</h1>
        <input className={`${inputCls} max-w-xs`} placeholder="Search name, phone, email…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <Table headers={['Customer', 'Contact', 'Orders', 'Wallet', 'Status', 'Joined', '']}>
        {items.map((u) => (
          <tr key={u.id} className="hover:bg-slate-50">
            <td className="px-4 py-2.5 font-medium">{u.fullName ?? '—'}</td>
            <td className="px-4 py-2.5 text-xs">{u.phoneNumber}<div className="text-slate-400">{u.email}</div></td>
            <td className="px-4 py-2.5">{u.customer?._count?.orders ?? 0}</td>
            <td className="px-4 py-2.5">{pkr(u.customer?.walletBalancePaisa)}</td>
            <td className="px-4 py-2.5"><Badge value={u.status} /></td>
            <td className="px-4 py-2.5 text-xs text-slate-400">{new Date(u.createdAt).toLocaleDateString()}</td>
            <td className="px-4 py-2.5 text-right">
              {u.status === 'SUSPENDED' ? (
                <button className={btnGhost} onClick={() => act(u.id, 'activate')}>Reactivate</button>
              ) : (
                <button className={btnDanger} onClick={() => confirm(`Suspend ${u.fullName ?? u.phoneNumber}?`) && act(u.id, 'suspend')}>Suspend</button>
              )}
            </td>
          </tr>
        ))}
        {!loading && items.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No customers.</td></tr>}
      </Table>
      <Pager page={page} totalPages={totalPages} setPage={setPage} />
      {node}
    </div>
  );
}
