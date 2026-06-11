import { useState } from 'react';
import { usePaged, Pager } from '../lib/usePaged';
import { Table, inputCls } from '../components/ui';

export default function Audit() {
  const [entityType, setEntityType] = useState('');
  const { items, page, setPage, totalPages, loading, error } = usePaged('/admin/audit-logs', { entityType });

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-xl font-bold">Audit log</h1>
        <select className={`${inputCls} w-auto`} value={entityType} onChange={(e) => setEntityType(e.target.value)}>
          {['', 'Merchant', 'Order', 'Product', 'Category', 'Coupon', 'Refund', 'Settlement', 'Rider', 'User', 'Payment', 'MerchantStaff'].map((s) => (
            <option key={s} value={s}>{s || 'All entities'}</option>
          ))}
        </select>
      </div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <Table headers={['When', 'Actor', 'Action', 'Entity', 'Details']}>
        {items.map((l) => (
          <tr key={l.id} className="hover:bg-slate-50">
            <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-400">{new Date(l.createdAt).toLocaleString()}</td>
            <td className="px-4 py-2 text-xs">{l.user?.fullName ?? l.user?.email ?? 'system'}<div className="text-slate-400">{l.role}</div></td>
            <td className="px-4 py-2 font-mono text-xs font-semibold">{l.action}</td>
            <td className="px-4 py-2 text-xs">{l.entityType}<div className="max-w-[120px] truncate font-mono text-[10px] text-slate-400">{l.entityId}</div></td>
            <td className="max-w-[340px] truncate px-4 py-2 font-mono text-[10px] text-slate-400" title={`${l.oldValue ?? ''} → ${l.newValue ?? ''}`}>
              {l.newValue ?? l.oldValue ?? ''}
            </td>
          </tr>
        ))}
        {!loading && items.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No audit entries.</td></tr>}
      </Table>
      <Pager page={page} totalPages={totalPages} setPage={setPage} />
    </div>
  );
}
