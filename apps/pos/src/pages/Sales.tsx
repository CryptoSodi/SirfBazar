import { useEffect, useState } from 'react';
import { api, dateTime, pkr } from '../lib/api';
import { Modal, Stat, Table, useToast } from '../components/ui';

type Sale = {
  id: string;
  orderNumber: string;
  totalAmountPaisa: number;
  createdAt: string;
  items: any[];
};

/** ISO start-of-day for a preset range. */
function since(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

const RANGES = [
  ['Today', 0],
  ['7 days', 6],
  ['30 days', 29],
] as const;

export default function Sales() {
  const [range, setRange] = useState(0);
  const [data, setData] = useState<{ count: number; totalPaisa: number; sales: Sale[] }>({
    count: 0,
    totalPaisa: 0,
    sales: [],
  });
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Sale | null>(null);
  const { toast, node } = useToast();

  useEffect(() => {
    setLoading(true);
    api
      .get(`/pos/sales?from=${encodeURIComponent(since(range))}`)
      .then(setData)
      .catch((e) => toast(e.message, false))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">POS sales</h1>
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {RANGES.map(([label, days], i) => (
            <button
              key={label}
              onClick={() => setRange(days)}
              className={`rounded-md px-3 py-1 text-sm font-medium ${
                range === days ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:max-w-md">
        <Stat label="Sales" value={data.count} />
        <Stat label="Revenue" value={pkr(data.totalPaisa)} />
      </div>

      <Table headers={['Receipt', 'Time', 'Items', 'Total', '']}>
        {data.sales.map((s) => (
          <tr key={s.id} className="hover:bg-slate-50">
            <td className="px-4 py-2.5 font-medium">{s.orderNumber}</td>
            <td className="px-4 py-2.5 text-slate-500">{dateTime(s.createdAt)}</td>
            <td className="px-4 py-2.5 text-slate-500">{s.items.reduce((n, it) => n + it.quantity, 0)}</td>
            <td className="px-4 py-2.5 font-semibold">{pkr(s.totalAmountPaisa)}</td>
            <td className="px-4 py-2.5 text-right">
              <button className="text-xs text-emerald-700 underline" onClick={() => setDetail(s)}>
                View
              </button>
            </td>
          </tr>
        ))}
        {!loading && data.sales.length === 0 && (
          <tr>
            <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
              No POS sales in this period.
            </td>
          </tr>
        )}
        {loading && (
          <tr>
            <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
              Loading…
            </td>
          </tr>
        )}
      </Table>

      {detail && (
        <Modal title={`Receipt #${detail.orderNumber}`} onClose={() => setDetail(null)}>
          <div className="mb-3 text-sm text-slate-500">{dateTime(detail.createdAt)}</div>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {detail.items.map((it: any) => (
              <li key={it.id} className="flex justify-between px-3 py-2 text-sm">
                <span>
                  {it.quantity} × {it.productNameSnapshot}
                </span>
                <span className="font-medium">{pkr(it.totalPricePaisa)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-lg font-black">
            <span>Total</span>
            <span>{pkr(detail.totalAmountPaisa)}</span>
          </div>
        </Modal>
      )}

      {node}
    </div>
  );
}
