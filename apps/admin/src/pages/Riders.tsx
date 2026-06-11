import { api } from '../lib/api';
import { usePaged, Pager } from '../lib/usePaged';
import { Badge, Table, btnDanger, btnGhost, useToast } from '../components/ui';

export default function Riders() {
  const { items, page, setPage, totalPages, loading, error, reload } = usePaged('/admin/riders', {});
  const { toast, node } = useToast();

  const act = async (id: string, action: 'suspend' | 'activate') => {
    try {
      await api.post(`/admin/riders/${id}/${action}`);
      toast(`Rider ${action}d`);
      reload();
    } catch (e: any) {
      toast(e.message, false);
    }
  };

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Riders</h1>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <Table headers={['Rider', 'Shop', 'Vehicle', 'Online', 'Status', 'Active order', '']}>
        {items.map((r) => (
          <tr key={r.id} className="hover:bg-slate-50">
            <td className="px-4 py-2.5 font-medium">{r.fullName}<div className="text-xs text-slate-400">{r.phoneNumber}</div></td>
            <td className="px-4 py-2.5">{r.merchant?.shopName}</td>
            <td className="px-4 py-2.5 text-xs">{r.vehicleType} {r.vehicleNumber && `· ${r.vehicleNumber}`}</td>
            <td className="px-4 py-2.5">{r.isOnline ? '🟢 online' : '⚪ offline'}</td>
            <td className="px-4 py-2.5"><Badge value={r.approvalStatus} /> {!r.isActive && <Badge value="INACTIVE" />}</td>
            <td className="px-4 py-2.5 text-xs">{r.currentOrderId ? `🛵 ${r.currentStatus}` : '—'}</td>
            <td className="px-4 py-2.5 text-right">
              {r.approvalStatus === 'SUSPENDED' ? (
                <button className={btnGhost} onClick={() => act(r.id, 'activate')}>Reinstate</button>
              ) : (
                <button className={btnDanger} onClick={() => confirm(`Suspend ${r.fullName}?`) && act(r.id, 'suspend')}>Suspend</button>
              )}
            </td>
          </tr>
        ))}
        {!loading && items.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No riders.</td></tr>}
      </Table>
      <Pager page={page} totalPages={totalPages} setPage={setPage} />
      {node}
    </div>
  );
}
