import { useState } from 'react';
import { api } from '../lib/api';
import { usePaged } from '../lib/usePaged';
import { Badge, Modal, Table, btnCls, btnDanger, btnGhost, inputCls, useToast } from '../components/ui';

export default function Categories() {
  const { items, loading, error, reload } = usePaged('/admin/categories', {});
  const [editing, setEditing] = useState<any | 'new' | null>(null);
  const { toast, node } = useToast();

  const remove = async (c: any) => {
    if (!confirm(`Delete category "${c.name}"?`)) return;
    try {
      await api.del(`/admin/categories/${c.id}`);
      toast('Category deleted');
      reload();
    } catch (e: any) {
      toast(e.message, false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-xl font-bold">Categories</h1>
        <button className={btnCls} onClick={() => setEditing('new')}>+ New category</button>
      </div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <Table headers={['Category', 'Slug', 'Products', 'Sort', 'Status', '']}>
        {items.map((c) => (
          <tr key={c.id} className="hover:bg-slate-50">
            <td className="px-4 py-2.5 font-medium">{c.iconUrl} {c.name}</td>
            <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{c.slug}</td>
            <td className="px-4 py-2.5">{c._count?.products ?? 0}</td>
            <td className="px-4 py-2.5">{c.sortOrder}</td>
            <td className="px-4 py-2.5"><Badge value={c.isActive ? 'ACTIVE' : 'INACTIVE'} /></td>
            <td className="space-x-1 px-4 py-2.5 text-right">
              <button className={btnGhost} onClick={() => setEditing(c)}>Edit</button>
              <button className={btnDanger} onClick={() => remove(c)}>Delete</button>
            </td>
          </tr>
        ))}
        {!loading && items.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No categories.</td></tr>}
      </Table>
      {editing && <CategoryModal category={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} toast={toast} />}
      {node}
    </div>
  );
}

function CategoryModal({ category, onClose, onSaved, toast }: any) {
  const [form, setForm] = useState({
    name: category?.name ?? '',
    iconUrl: category?.iconUrl ?? '',
    sortOrder: category?.sortOrder ?? 0,
    isActive: category?.isActive ?? true,
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      if (category) await api.put(`/admin/categories/${category.id}`, { ...form, sortOrder: Number(form.sortOrder) });
      else await api.post('/admin/categories', { ...form, sortOrder: Number(form.sortOrder) });
      toast('Category saved');
      onSaved();
    } catch (e: any) {
      toast(e.message, false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={category ? `Edit ${category.name}` : 'New category'} onClose={onClose}>
      <div className="space-y-2 text-sm">
        <input className={inputCls} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className={inputCls} placeholder="Icon (emoji)" value={form.iconUrl} onChange={(e) => setForm({ ...form, iconUrl: e.target.value })} />
        <input className={inputCls} placeholder="Sort order" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active
        </label>
        <button className={`${btnCls} w-full`} onClick={save} disabled={busy || !form.name}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </Modal>
  );
}
