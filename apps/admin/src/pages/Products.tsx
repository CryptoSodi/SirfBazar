import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { usePaged, Pager } from '../lib/usePaged';
import { Badge, Modal, Table, btnCls, btnDanger, btnGhost, inputCls, useToast } from '../components/ui';

export default function Products() {
  const [approvalStatus, setApprovalStatus] = useState('');
  const [q, setQ] = useState('');
  const { items, page, setPage, totalPages, loading, error, reload } = usePaged('/admin/products', { approvalStatus, q });
  const [editing, setEditing] = useState<any | 'new' | null>(null);
  const { toast, node } = useToast();

  const act = async (id: string, action: string, body?: any) => {
    try {
      await api.post(`/admin/products/${id}/${action}`, body ?? {});
      toast('Done');
      reload();
    } catch (e: any) {
      toast(e.message, false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">Products</h1>
        <select className={`${inputCls} w-auto`} value={approvalStatus} onChange={(e) => setApprovalStatus(e.target.value)}>
          {['', 'PENDING', 'APPROVED', 'REJECTED', 'DISABLED'].map((s) => <option key={s} value={s}>{s || 'All statuses'}</option>)}
        </select>
        <input className={`${inputCls} max-w-xs`} placeholder="Search name…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className={btnCls} onClick={() => setEditing('new')}>+ New product</button>
      </div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <Table headers={['Product', 'Category', 'Unit', 'Listings', 'Status', '']}>
        {items.map((p) => (
          <tr key={p.id} className="hover:bg-slate-50">
            <td className="px-4 py-2.5 font-medium">{p.name}<div className="text-xs text-slate-400">{p.brand}</div></td>
            <td className="px-4 py-2.5">{p.category?.name}</td>
            <td className="px-4 py-2.5 text-xs">{p.size ?? p.unit}</td>
            <td className="px-4 py-2.5">{p._count?.merchantProducts ?? 0} shops</td>
            <td className="px-4 py-2.5"><Badge value={p.approvalStatus} /></td>
            <td className="space-x-1 px-4 py-2.5 text-right">
              {p.approvalStatus === 'PENDING' && (
                <>
                  <button className={btnCls} onClick={() => act(p.id, 'approve')}>✓</button>
                  <button className={btnDanger} onClick={() => { const reason = prompt('Rejection reason:'); if (reason !== null) act(p.id, 'reject', { reason }); }}>✗</button>
                </>
              )}
              {p.approvalStatus === 'APPROVED' && <button className={btnDanger} onClick={() => act(p.id, 'disable')}>Disable</button>}
              {['REJECTED', 'DISABLED'].includes(p.approvalStatus) && <button className={btnGhost} onClick={() => act(p.id, 'approve')}>Re-approve</button>}
              <button className={btnGhost} onClick={() => setEditing(p)}>Edit</button>
            </td>
          </tr>
        ))}
        {!loading && items.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No products.</td></tr>}
      </Table>
      <Pager page={page} totalPages={totalPages} setPage={setPage} />
      {editing && <ProductModal product={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} toast={toast} />}
      {node}
    </div>
  );
}

function ProductModal({ product, onClose, onSaved, toast }: any) {
  const [categories, setCategories] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: product?.name ?? '',
    brand: product?.brand ?? '',
    categoryId: product?.categoryId ?? '',
    unit: product?.unit ?? 'piece',
    size: product?.size ?? '',
    description: product?.description ?? '',
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/admin/categories').then(setCategories).catch(() => undefined);
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      if (product) await api.put(`/admin/products/${product.id}`, form);
      else await api.post('/admin/products', form);
      toast('Product saved');
      onSaved();
    } catch (e: any) {
      toast(e.message, false);
    } finally {
      setBusy(false);
    }
  };

  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  return (
    <Modal title={product ? `Edit ${product.name}` : 'New product'} onClose={onClose}>
      <div className="space-y-2 text-sm">
        <input className={inputCls} placeholder="Name" value={form.name} onChange={set('name')} />
        <input className={inputCls} placeholder="Brand (optional)" value={form.brand} onChange={set('brand')} />
        <select className={inputCls} value={form.categoryId} onChange={set('categoryId')}>
          <option value="">Choose category…</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input className={inputCls} placeholder="Unit (kg/piece/pack)" value={form.unit} onChange={set('unit')} />
          <input className={inputCls} placeholder="Size (e.g. 1 L)" value={form.size} onChange={set('size')} />
        </div>
        <textarea className={inputCls} placeholder="Description" value={form.description} onChange={set('description')} rows={3} />
        <button className={`${btnCls} w-full`} onClick={save} disabled={busy || !form.name || !form.categoryId}>
          {busy ? 'Saving…' : 'Save product'}
        </button>
      </div>
    </Modal>
  );
}
